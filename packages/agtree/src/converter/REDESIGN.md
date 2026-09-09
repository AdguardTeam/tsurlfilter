# Converter API Redesign — Research & Proposal

> Status: **research / proposal**. This document is the basis for the next
> implementation steps. Since agtree v5 is a dev branch, breaking changes are
> acceptable.

## 1. Goal

Provide a single, first-class **raw filter list → raw filter list** converter in
agtree that:

1. Converts a whole filter list text and returns the converted text **plus a
   source map** that links every converted line back to its original rule.
2. Absorbs the logic currently living outside agtree in
   [`packages/tsurlfilter/src/filterlist/filter-list.ts`](../../../tsurlfilter/src/filterlist/filter-list.ts)
   so tsurlfilter (and every other consumer) no longer needs to re-implement
   line splitting, conversion bookkeeping and reverse mapping.
3. Owns the parser **detail level** internally — callers should not have to
   know which `ParseOptions` flags a correct conversion requires.
4. Leans on the **binary/structural view** (`ctx.data`) so that rules which do
   not need conversion are emitted verbatim with zero AST allocation, and only
   conversion *candidates* are materialized into an AST.

## 2. Current State

### 2.1 Converter layering (agtree)

```text
RawFilterListConverter.convertToAdg(text)      ← string in / string out
  └─ FilterListPipeline.parse(text)            ← parse WHOLE list to AST
  └─ FilterListConverter.convertToAdg(ast)     ← walk AST children
        └─ RuleConverter.convertToAdg(node)    ← per-rule dispatch
              ├─ CommentRuleConverter
              ├─ CosmeticRuleConverter  (scriptlet / css / html / elemhide …)
              └─ NetworkRuleConverter   (modifier list rewrite)
  └─ FilterListGenerator.generate(ast)         ← serialize WHOLE list back

RawRuleConverter.convertToAdg(line)            ← string in / string[] out
  └─ sharedRuleParser.parse(line)              ← parse ONE line to AST
  └─ RuleConverter.convertToAdg(node)
  └─ node.map(RuleGenerator.generate)          ← serialize
```

Relevant files:

- [`converter/raw-filter-list.ts`](raw-filter-list.ts) — string wrapper over the AST filter-list converter.
- [`converter/raw-rule.ts`](raw-rule.ts) — string wrapper over the AST rule converter.
- [`converter/filter-list.ts`](filter-list.ts) — AST filter-list converter (`MultiValueMap` of index → rules).
- [`converter/rule.ts`](rule.ts) — per-rule dispatch by `RuleCategory`.
- [`converter/base-interfaces/conversion-result.ts`](base-interfaces/conversion-result.ts) —
  `ConversionResult<T, U>` `{ result, isConverted }`.

### 2.2 The external "hack" (tsurlfilter)

[`FilterList`](../../../tsurlfilter/src/filterlist/filter-list.ts) re-implements
the whole raw-list conversion loop **on top of** `RawRuleConverter.convertToAdg`
because agtree does not expose a source map:

- Splits the source into lines with `findNextLineBreakIndex` (preserving CR/LF).
- Calls `RawRuleConverter.convertToAdg(line)` per line.
- Builds `ConversionData`:

  ```ts
  interface ConversionData {
      originals: string[];                 // original text of converted rules
      conversions: Record<number, number>; // converted-line START OFFSET → index in originals
  }
  ```

- Collects `FilterListConversionError[]` (rule text, byte offset, message, filterId).
- Exposes a read API used across the monorepo:
  `getContent`, `getConversionData`, `getConversionErrors`, `getRuleText(offset)`,
  `getOriginalRuleText(offset)`, `getConvertedRuleOriginal(offset)`,
  `getOriginalContent()`, plus `createEmpty` / `createEmptyConversionData`.

### 2.3 Who consumes what

- `ConversionData` is a **persisted, cross-package data contract** (validated by
  a zod schema in tsurlfilter, stored in tswebextension `FiltersStorage`,
  transferred through `@adguard/api` / `@adguard/api-mv3`, and referenced by
  `@adguard/dnr-rulesets` metadata). Any redesign must keep an equivalent,
  serializable mapping (or provide a migration).
- `getContent()` (the converted text) is consumed nearly everywhere.
- `getOriginalContent()` / `getOriginalRuleText()` power the AdGuard assistant
  (show the user their original rule, not the converted one) and rule export.

### 2.4 Problems with the current design

1. **Responsibility leak.** The list-level conversion + source-map algorithm
   lives in tsurlfilter, not agtree. Every consumer that wants a source map must
   depend on tsurlfilter or re-implement it.
2. **Two parse strategies.** `RawFilterListConverter` parses the whole list into
   one big AST (`FilterListPipeline`) and serializes it back; tsurlfilter's
   `FilterList` parses **line by line** via `RawRuleConverter`. The
   `RawFilterListConverter` path throws away line breaks / offsets and therefore
   can't produce a source map, which is exactly why tsurlfilter bypasses it.
3. **Always full AST.** Every line is fully parsed to an AST and serialized back,
   even the ~99% of rules that need no conversion. That is a lot of allocation
   for a verbatim copy.
4. **Detail level is implicit and fragile.** Correct conversion depends on parse
   flags (`parseCssSelectorList`, `parseCssDeclarationList`,
   `parseHtmlFilteringRuleBodies`, `parseUboSpecificRules`,
   `parseAbpSpecificRules`, …). `RawRuleConverter` uses parser defaults; some of
   those default **off**, so a raw conversion can silently under-parse a rule.
   The caller has no principled way to know the right flags.
5. **`isConverted` requires materialization.** Today the only way to learn a rule
   needs no conversion is to build its AST, convert, and compare. The structural
   layer already knows enough to skip most of that work.

## 3. Key Insight: AST vs. Binary View

The user asked whether the **binary view** (`ctx.data`, the zero-allocation
`Int32Array` structural map — see [OVERVIEW.md](../OVERVIEW.md)) could replace
the AST for conversion. Findings:

- **Pass-through rules (the common case): binary view is enough.** For a rule
  that needs no conversion, we only need its `[ruleStart, ruleEnd)` span to copy
  it verbatim. The `FilterListScanner`
  ([`filter-list/scanner.ts`](../filter-list/scanner.ts)) already yields exactly
  `(kind, ruleStart, ruleEnd, ctx)` per rule with **zero heap allocation**.
- **Conversion itself: binary view is NOT enough.** The real transforms are
  semantic and *synthesize text that is not present in the source*, e.g.
  `queryprune → removeparam`, `inline-script → csp=script-src …`, scriptlet name
  mapping / quote normalization / argument reordering
  ([`misc/network-rule-modifier.ts`](misc/network-rule-modifier.ts),
  [`cosmetic/scriptlet.ts`](cosmetic/scriptlet.ts)). Pure span-splicing cannot
  express these. Candidates still need a real AST.
- **Therefore the right split is a cheap binary-view *pre-filter* + AST only for
  candidates.** The scanner already exposes the structural `kind` and `ctx.data`
  (modifier records, separator kind, syntax flags). We can decide *"could this
  rule possibly need conversion?"* directly from that data and only build an AST
  when the answer is yes.

### 3.1 Conversion-candidate pre-filter (binary view)

A rule is a conversion candidate if any of the following hold — all detectable
from `ctx.data` / the structural kind without allocating an AST:

- **Network rule** whose modifier list contains at least one modifier name in
  the ADG conversion map (`1p`, `3p`, `css`, `doc`, `ehide`, `empty`,
  `first-party`, `frame`, `ghide`, `inline-font`, `inline-script`, `mp4`,
  `queryprune`, `shide`, `xhr`, redirect aliases, …). Modifier name spans are
  already located in `ctx.data`, so this is a set-membership check on token
  ranges.
- **Cosmetic rule** whose separator kind / syntax flags indicate a non-ADG
  dialect (uBO/ABP scriptlet, uBO CSS injection, uBO/ABP HTML filtering, ABP
  snippet) — the separator kind is stored in the cosmetic header
  (`CR_SEP_KIND_*` in [`parser/cosmetic/constants.ts`](../parser/cosmetic/constants.ts)).
- **Comment rule** that is a convertible agent/hint (rare; can start as
  "always-candidate for comments" and refine later).

Everything else is copied verbatim from its source span. This turns the common
path into a memcpy-style loop and reserves allocation for the minority of rules
that actually change.

> The exact candidate predicate should be validated against the existing
> converter test corpus so we never skip a rule the AST converter would have
> changed (see §7). The pre-filter must be **sound**: it may over-select (a
> candidate that turns out unchanged is fine) but must never under-select.

## 4. Proposed API

### 4.1 New class: `FilterListConversionResult`

A serializable result object that replaces both the ad-hoc `ConversionData` and
the tsurlfilter `FilterList` read API. Lives in agtree.

```ts
/** Serializable source map: converted-line start offset → original rule text. */
export interface ConversionSourceMap {
    /** Original text of every rule that was converted (deduped by insertion). */
    originals: string[];
    /** Converted-line START offset (0-based) → index into `originals`. */
    conversions: Record<number, number>;
}

export interface FilterListConversionError {
    rule: string;    // original rule text that failed
    offset: number;  // byte offset in the ORIGINAL content
    message: string;
}

export class FilterListConversionResult {
    /** Converted filter list text. */
    readonly converted: string;
    /**
     * Target product the list was converted to (`adg` / `ubo` / `abp`).
     * Reuses the existing `ProductCode` enum from
     * `compatibility-tables/platform.ts`. Set from the conversion entry point
     * (`convertToAdg → ProductCode.Adg`, etc.).
     */
    readonly product: ProductCode;
    /** Source map linking converted lines back to originals. */
    readonly sourceMap: ConversionSourceMap;
    /** Non-fatal per-rule conversion errors (tolerant mode). */
    readonly errors: readonly FilterListConversionError[];
    /** True if at least one rule was converted. */
    readonly isConverted: boolean;

    // --- reverse lookups (migrated from tsurlfilter FilterList) ---
    getRuleText(offset: number): string | null;
    getOriginalRuleText(offset: number): string | null;
    getConvertedRuleOriginal(offset: number): string | null;
    getOriginalContent(): string;

    static empty(product: ProductCode): FilterListConversionResult;
}
```

Notes:

- `product` records the **target format** of the conversion using the existing
  `ProductCode` enum (`ProductCode.Adg` / `ProductCode.Ubo` / `ProductCode.Abp`).
  This lets consumers persist/branch on which dialect the stored converted text
  is in (e.g. skip re-converting already-ADG content, or pick the right reverse
  transform) without inferring it from the text. It also makes the future
  `convertToUbo` / `convertToAbp` entry points self-describing — each sets
  `product` to its target. `ProductCode.Any` is not a valid conversion target
  and must never appear here.
- `ConversionSourceMap` is intentionally **structurally identical** to the
  current `ConversionData` (`originals` + `conversions`). Keeping the same shape
  means tswebextension storage, the zod validator, and dnr-rulesets metadata
  keep working with only an import move (`@adguard/tsurlfilter` →
  `@adguard/agtree`). The zod validator should move into agtree too.
- The reverse-lookup helpers (`getOriginalRuleText`, `getOriginalContent`, …)
  are moved verbatim in behavior from tsurlfilter so downstream code is a
  drop-in swap.

### 4.2 New entry point: `RawFilterListConverter` (redesigned)

```ts
export interface FilterListConvertOptions {
    /**
     * Tolerant mode: invalid/failed rules are kept verbatim and recorded in
     * `errors` instead of throwing. Defaults to `true`.
     */
    tolerant?: boolean;
}

export class RawFilterListConverter {
    /** Convert a raw filter list to AdGuard format with a source map. */
    static convertToAdg(
        rawFilterList: string,
        options?: FilterListConvertOptions,
    ): FilterListConversionResult;    // result.product === ProductCode.Adg

    // convertToUbo / convertToAbp — future
}
```

Behavior:

1. Drive the existing **`FilterListScanner`** over the source (chunked,
   zero-alloc). For each scanned rule it receives `(kind, ruleStart, ruleEnd, ctx)`.
2. Run the **binary-view candidate pre-filter** (§3.1).
   - **Not a candidate** → append `source.slice(ruleStart, lineEnd)` verbatim; no
     AST, no source-map entry.
   - **Candidate** → build the AST for that single rule *at the correct detail
     level* (§4.3), run `RuleConverter.convertToAdg`, and:
     - if `isConverted` → append each generated line (preserving the original
       line break), push original into `sourceMap.originals`, record
       `conversions[convertedLineStartOffset] = originalIndex`;
     - if not actually converted → append verbatim.
   - On throw → tolerant: keep verbatim + push `FilterListConversionError`;
     strict: rethrow.
3. Return a `FilterListConversionResult`.

This folds the tsurlfilter line loop into agtree while replacing "parse every
line" with "structurally scan every line, parse only candidates".

### 4.3 Internal, fixed detail level

The converter selects the parse detail level itself. Candidates are parsed with
the flags conversion actually needs, e.g.:

```ts
const CONVERTER_PARSE_OPTIONS: ParseOptions = {
    isLocIncluded: false,
    parseUboSpecificRules: true,
    parseAbpSpecificRules: true,
    parseHtmlFilteringRuleBodies: true,
    parseCssSelectorList: true,     // needed by cosmetic CSS conversions
    parseCssDeclarationList: true,  // needed by cosmetic CSS conversions
    // parseHostRules: host-rule conversion is currently a pass-through
};
```

The exact set must be pinned by the converter test corpus (§7). Callers never
pass parse flags — this removes the "implicit/fragile detail level" foot-gun and
guarantees conversions never silently under-parse.

### 4.4 Single-rule converter stays

`RawRuleConverter.convertToAdg(line)` remains for one-off single-rule
conversion (it is used directly by tests and by tswebextension for HTML/cosmetic
rule handling). It should share the same fixed detail level as the list
converter so single-rule and list conversion can never disagree.

## 5. Impact on `tsurlfilter/filter-list.ts`

The tsurlfilter `FilterList` class becomes a **thin adapter** (or is removed):

- Construction from raw content delegates to
  `RawFilterListConverter.convertToAdg(content)` and stores the returned
  `FilterListConversionResult`.
- Construction from **already-converted content + stored source map**
  (`new FilterList(content, filterId, data)`) wraps an existing
  `ConversionSourceMap` into a `FilterListConversionResult` without re-converting.
- All read methods (`getContent`, `getConversionData`, `getRuleText`,
  `getOriginalRuleText`, `getConvertedRuleOriginal`, `getOriginalContent`,
  `getConversionErrors`) forward to the agtree result object.
- `filterId` tagging of errors stays in tsurlfilter (agtree is filter-id
  agnostic — errors carry `offset`/`message`, tsurlfilter adds `filterId`).

Net effect: the conversion algorithm and source-map bookkeeping move into agtree;
tsurlfilter keeps only its id-tagging + storage-shape concerns.

## 6. Benefits

- **Correct code organization.** Raw-to-raw conversion + source map is an agtree
  responsibility; every consumer gets it for free.
- **One conversion strategy.** The whole-list AST path
  (`FilterListPipeline` + `FilterListGenerator`) and the tsurlfilter line loop
  collapse into a single scanner-driven path.
- **Less allocation.** Non-candidate rules (the vast majority) never allocate an
  AST or re-serialize — they are copied from their source span. Only candidates
  hit the AST builder + generator.
- **Detail level guaranteed.** Conversion always parses at the level it needs;
  no caller can misconfigure it.
- **Self-describing target.** The `product` field records the conversion target
  (`adg`/`ubo`/`abp`) on the result, so consumers can branch/persist on dialect
  without re-parsing the text.
- **Backward-compatible data shape.** `ConversionSourceMap` == existing
  `ConversionData`, so persisted data and the tswebextension/dnr-rulesets
  contracts keep working with an import move.

## 7. Open Questions / Validation Before Implementing

1. **Candidate pre-filter soundness.** Enumerate every transform each
   sub-converter can perform and prove the binary-view predicate never
   under-selects. Concretely: for network rules, the trigger set must equal the
   union of every key the modifier converters can rewrite; for cosmetic rules,
   confirm the separator-kind/syntax-flag signal covers all scriptlet/CSS/HTML
   conversions. Guard with the existing converter tests
   ([`test/converter/`](../../../test/converter)).
2. **Whole-list AST converter fate.** Should `FilterListConverter`
   (AST → AST) and `RawFilterListConverter`'s old whole-list-parse path be
   removed, or kept for callers who genuinely want an AST list? Proposal: keep
   the AST `RuleConverter` (per-rule, used by candidates) and delete the
   whole-list AST converter, since the scanner path supersedes it.
3. **Source-map key stability.** `conversions` is keyed by converted-line **start
   offset**. Confirm multi-line expansions (one rule → many lines) and files
   without a trailing newline behave exactly as tsurlfilter does today (there is
   dedicated handling for the "no final line break + multi-line output" case).
4. **`ConversionData` → `ConversionSourceMap` migration.** Decide whether to
   rename or alias. Since the shape is identical, an exported type alias +
   moving the zod validator into agtree is the low-risk path; tsurlfilter
   re-exports for compatibility.
5. **Reverse mapping performance.** `getOriginalContent()` currently rescans the
   converted text with `findNextLineBreakIndex`. Keep as-is (O(n) once) or
   precompute during conversion? Likely keep lazy.
6. **uBO/ABP output.** `convertToUbo` / `convertToAbp` are still unimplemented;
   design the candidate pre-filter so it is target-aware from the start (the
   trigger set differs per target).
7. **Persisting `product`.** Decide whether the target `product` should also be
   stored alongside the persisted `ConversionSourceMap` (tswebextension storage /
   dnr-rulesets metadata). Today all stored conversions are implicitly ADG; once
   `convertToUbo`/`convertToAbp` land, persisting `product` avoids ambiguity. If
   added to the stored contract it must be optional (defaulting to `adg`) so old
   data keeps validating.

## 8. Suggested Next Steps

1. Land `ConversionSourceMap` + `FilterListConversionResult` types and move the
   zod validator into agtree.
2. Implement the binary-view candidate pre-filter behind the `FilterListScanner`
   and cover it with the converter test corpus (prove soundness).
3. Reimplement `RawFilterListConverter.convertToAdg` on top of the scanner +
   pre-filter + fixed detail level, producing `FilterListConversionResult`.
4. Reduce tsurlfilter `FilterList` to an adapter over the agtree result; move its
   tests' expectations onto the agtree converter.
5. Delete the superseded whole-list AST converter path (pending Q7.2).
6. Update `CHANGELOG.md` for agtree (new converter API) and tsurlfilter
   (FilterList now delegates to agtree).
