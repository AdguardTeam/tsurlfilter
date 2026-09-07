# tsurlfilter optimization ideas for the agtree v5 pipeline

Research notes on where `@adguard/tsurlfilter` still builds (and immediately
discards) AGTree AST nodes, and how it could consume the agtree v5 binary
(structural) parser output instead.

Scope (per discussion on the agtree v5 dev branch, 2026-09):

- **Only the necessary / trivial steps** — this is *not* a proposal to rewrite
  the engine. Each idea is meant to be small, reviewable, and independently
  mergeable.
- Breaking changes are fine (this branch tracks the unreleased agtree v5).
- Goal: faster engine creation / rule materialization, less GC pressure, and
  better DX (delete duplicated parsing logic).

Reference: [agtree pipeline overview](../agtree/src/OVERVIEW.md) — the three
stages (tokenizer → structural parser → AST builder) and the statement that
**only stage 3 allocates**; stages 1–2 write into a reusable flat
`Int32Array` (`ctx.data`) with a documented, stable layout.

---

## 1. What agtree v5 already computes (and tsurlfilter re-derives)

AGTree v5's structural parser fills `ctx.data` with everything the rule
classes eventually need. The layouts are documented in agtree sources:

| Data | Where in `ctx.data` | Currently in tsurlfilter |
| --- | --- | --- |
| `@@` exception flag | `NR_FLAGS_OFFSET` / `NR_FLAG_EXCEPTION` | `parsedNode.exception` |
| pattern start/end | `NR_PATTERN_START/END_OFFSET` | `parsedNode.pattern.value` |
| regex-literal pattern | `NR_FLAG_PATTERN_REGEX` | `startsWith('/') && endsWith('/')` |
| modifier count | `NR_MODIFIER_COUNT_OFFSET` | `modifiers.children.length` |
| modifier name/value, negation | modifier records: name/value offsets, negation | `Modifier`/`Value` AST nodes |
| cosmetic separator kind, exception | `CR_FLAGS_OFFSET` bits (`CR_SEP_KIND_*`) | `CosmeticRuleSeparatorUtils` |
| cosmetic domain list | `CR_DOMAIN_COUNT` + domain records (`DOMAIN_FLAG_EXCEPTION`) | `DomainList` AST node |
| cosmetic body range | `CR_BODY_START` / `CR_BODY_END` | `CosmeticRuleBodyGenerator` |
| scriptlet params | scriptlet body region: `paramCount` + per-param offsets | `ParameterList` AST node + `QuoteUtils` |

In other words: **the AST stage is pure overhead for rule matching.** The rule
classes (`NetworkRule`, `CosmeticRule`, `HostRule`) destructure the AST into
exactly the fields listed above and then drop it.

---

## 2. Current data flow (what happens today, with references)

```text
filter list string
  │
  ▼ FilterList.prepare                            (src/filterlist/filter-list.ts)
  │   per line: RawRuleConverter.convertToAdg    ← allocates a NEW RuleParserPipeline per line (upstream!)
  │   string += growth for the whole converted buffer
  ▼ RuleScanner.scan → getRuleParts               (src/filterlist/scanner/rule-scanner.ts)
  │   ~900-line hand-rolled classifier            (src/filterlist/rule-parts.ts)
  │   producing offset-based RuleParts            ← duplicates agtree's structural parser
  ▼ Engine.create{Sync,Async}                      (src/engine/engine.ts)
  │   collects IndexedStorage{Network,Cosmetic}RuleParts
  ▼ NetworkEngine / CosmeticEngine .addRule        (lookup tables built from offsets — cheap)
  │   BUT: CosmeticLookupTable.addRule materializes FULL CosmeticRule objects
  │   for generic rules at build time (retrieved via RuleStorage → RuleFactory → full AST parse)
  ▼ match(request)
      RuleStorage.retrieveRule                     (src/filterlist/rule-storage.ts)
        RuleFactory.createRule                     (src/rules/rule-factory.ts)
          RuleParserPipeline.parse                 ← full AST (strings + objects) built here
          new NetworkRule/CosmeticRule/HostRule(...)← destructures AST, AST becomes garbage
        cache.set(storageIdx, rule)                 ← unbounded Map
```

Concrete waste observed:

1. **AST built and immediately discarded** in `NetworkRule`/`CosmeticRule`/
   `HostRule` constructors — every `Value`, `Modifier`, `ModifierList`,
   `DomainList`, `ParameterList` node plus their `value` strings. For a rule
   with *N* modifiers that is roughly `2N + 3` objects + strings that never
   outlive the constructor.
2. **`getRuleParts` re-implements classification** (network `$` separator,
   cosmetic `##`-family separators, host rules, comments, `[$modifier]`
   prefixes) in hand-written scans — including regex-region hacks
   (`isDollarInsideRegex`) whose own comments say to keep them in sync with
   AGTree.
3. **Four separate `RuleParserPipeline` static instances** (`RuleFactory`,
   `NetworkRule`, `CosmeticRule`, `HostRule`), each owning its own tokenizer +
   context buffers.
4. **Fresh `{ parseHostRules, parseHtmlFilteringRuleBodies }` options object
   allocated on every `createRule` call** (options are supposed to be
   immutable pass-throughs — pre-allocate them).
5. **`RawRuleConverter.convertToAdg` does `new RuleParserPipeline()` per
   call** (agtree, `src/converter/raw-rule.ts`) — and tsurlfilter calls it
   once **per line** in `FilterList.prepare`. This singlehandedly defeats the
   "allocate once, reuse forever" design of v5. (Fix belongs in agtree, but
   the win lands here.)
6. **`CosmeticRule.content` is re-serialized from the AST**
   (`CosmeticRuleBodyGenerator.generate(parsedNode)`), although for the
   overwhelming majority of rules it equals `source.slice(bodyStart,
   bodyEnd)`.
7. **`RuleStorage.cache` is an unbounded `Map<number, IRule>`** — grows with
   every distinct materialized rule (the `Engine` result cache is an LRU of
   500; the rule cache has no cap).

---

## 3. Ideas

Ordered by effort / risk. Tier 0 is trivial, Tier 1 is the actual
"discard the AST, use binary data" work, Tier 2 is the follow-up that removes
`getRuleParts` entirely.

### Tier 0 — trivial fixes, no semantic risk (do regardless)

1. **One shared parser pipeline.** Replace the four
   `private static readonly PARSER = new RuleParserPipeline()` fields with a
   single module-level (or shared in `RuleFactory`) instance. While at it,
   pre-allocate the reusable `ParseOptions` variants instead of creating a
   new options object per `createRule` call. (Note: agtree's design rules
   forbid *static singleton* pipelines inside agtree itself; a single
   non-static shared instance used in one consumer is fine. Keep an escape
   hatch for tests.)

2. **`FilterList.prepare` string building.** Collect converted lines in an
   array and `join('')` once at the end, instead of `convertedBuffer += ...`
   in the loop. Same for `originals` handling (minor, but free).

3. **Upstream (agtree): hoist the parser in `RawRuleConverter`.** Module-level
   shared `RuleParserPipeline` (or accept an optional parser parameter).
   One-line change in agtree, immediately cuts tsurlfilter's
   filter-list preparation cost — today every line of every filter list
   allocates a full tokenizer + `Int32Array` context (~10 KB of buffers).

4. **`RuleGenerator.generate` in the `isTooGeneral` error path**
   (`NetworkRule` constructor): the re-serialization is only used in the
   error message — use `ruleText` instead.

5. **`NetworkRule.loadOption` switch → lookup map** — there is already a
   `TODO: Speed up this by creating a map from names to bit mask positions`
   in the code. Measure before/after; do only if benchmarks approve.

6. **(Optional) cap `RuleStorage.cache`** with an `LRUCache` like the engine
   result cache, or at least verify current memory growth on large rule
   sets before deciding. Risk: cache misses re-trigger rule parsing — needs a
   benchmark to decide the size (or skip).

### Tier 1 — consume the binary parser output in rule classes (the core idea)

**Prerequisite — small agtree API additions.** Today `@adguard/agtree/parser`
exports `createParserContext`, `initParserContext`, `StructuralRuleParser`,
`NetworkRuleParser`, `RuleClassifier`, etc., but *deliberately not* the
`Tokenizer` nor the buffer-layout constants. For tsurlfilter to skip the AST
stage, agtree needs one of:

- **Option A (preferred, encapsulated):** a `parseStructural(source, options?)
  → { kind, ctx }` method on `RuleParserPipeline` (tokenizer + structural
  parse, no AST build), plus **typed readers** wrapping `ctx.data`, e.g.:

  ```ts
  // sketch — agtree public API
  class NetworkRuleDataReader {
      constructor(source: string, data: Int32Array, dataOffset = 0);
      get exception(): boolean;
      getPattern(): string;                       // source.slice(...)
      get modifierCount(): number;
      getModifierName(i): string;                 // source.slice(...)
      getModifierValue(i): string | null;         // source.slice(...) or null
      isModifierNegated(i): boolean;
      isPatternRegex(): boolean;                  // NR_FLAG_PATTERN_REGEX
  }
  ```

  Readers keep the layout (offsets/strides) an internal detail of agtree,
  which matches the stated policy in `src/parser/index.ts`.

- **Option B (quicker, more brittle):** export the `Tokenizer` and the
  `NR_*`/`CR_*`/`MODIFIER_*`/`DOMAIN_*` constants from the `./parser`
  subpath and let tsurlfilter read `ctx.data` directly. Fast to do, but it
  freezes the layout as public API for one consumer.

- Also needed: a binary **host-rule candidate check** (currently
  `HostRuleAstBuilder.isCandidate(this.ctx)` is internal to the pipeline) —
  expose `isHostRuleCandidate(ctx)` or fold host detection into the kind /
  reader API.

Then, in tsurlfilter:

1. **`NetworkRule`: binary constructor path.** Add (breaking change is OK on
   this branch) a constructor path that takes `source` + populated `ctx.data`
   instead of an AST node:

   - `exception` ← flags bit;
   - `pattern` ← single `source.slice(patternStart, patternEnd)` (reuse for
     the existing `hasSpaces` check and `isTooGeneral`, which becomes
     `modifierCount === 0 && pattern.length < 4`);
   - `loadOptions` iterates modifier *records* (name slice, optional value
     slice, negation bit) instead of `Modifier` nodes — the big
     `loadOption(name, value, exception)` switch stays as-is, so validation
     semantics are unchanged;
   - `DomainModifier` for `$domain=` — see next item.

2. **`DomainModifier`: consume binary domain records.** The network parser
   already structurally parses `$domain=` values into domain records
   (`DOMAIN_RECORD_STRIDE` = start/end/exception-flag per domain). Add an
   overload that takes a records view and builds `permittedDomains` /
   `restrictedDomains` directly via `source.slice(...)` +
   `toLowerCase()` — no `parseDomainList` AST (`DomainList`/`Domain`/string
   nodes), no extra `.map(unescapeChar)` round-trips.

   Note: `DomainModifier` is also constructed from `RuleParts` offsets in the
   cosmetic lookup table (`ruleParts.text.slice(...).split(',')`), which the
   same overload can serve.

3. **`CosmeticRule`: binary constructor path.** Read from `CR_*`:

   - `allowlist` / `type` / extended-CSS flags ← `CR_FLAGS_OFFSET` bits
     (separator kind + `CR_FLAG_*`), replacing
     `CosmeticRuleSeparatorUtils` on AST strings;
   - `content` ← `source.slice(CR_BODY_START, CR_BODY_END)` (drop
     `CosmeticRuleBodyGenerator.generate` on this path; it remains for
     [`$modifier`-prefixed](https://adguard.com/kb/general/ad-filtering/create-own-filters/#non-basic-modifiers)
     rules where re-serialization is genuinely needed);
   - `domainModifier` ← cosmetic domain records (same binary
     `DomainModifier` overload as above);
   - scriptlet params ← scriptlet body region (param count + per-param
     start/end), replacing `ParameterList` AST walking and part of the
     `QuoteUtils` work;
   - validation (`validateSelectorList`, scriptlet name checks, …) already
     works on strings — unchanged.

4. **`HostRule`: binary path** — hostnames + IP straight from the structural
   output (candidate check per prerequisite above).

5. **`RuleFactory`: parse once, structurally.** `createRule` runs the shared
   pipeline in *structural* mode, dispatches on `RuleKind`
   (comment/invalid/empty → `null`; network vs cosmetic vs host) and calls
   the new binary constructors. The AST path remains available (an explicit
   overload / option) for callers that genuinely need nodes —
   `rule-syntax-utils` for instance — but the engine matching path stops
   building ASTs entirely.

### Tier 2 — replace `getRuleParts` with the structural classifier

Once Tier 1 readers exist, `src/filterlist/rule-parts.ts` (~900 lines) can be
retired:

- `RuleScanner.scan()` runs tokenize → `StructuralRuleParser.parse(ctx)` per
  line (buffers reused across lines / lists) and maps `ctx.data` into the
  existing `RuleParts` shape as a **thin adapter** — so
  `NetworkEngine`/`CosmeticEngine` lookup tables, `RuleStorageScanner`, and
  storage indices keep working unchanged (trivial first step, zero consumer
  churn).
- This deletes `findNetworkRuleSeparatorIndex`, `isDollarInsideRegex`,
  `findHashmarkBasedCosmeticSeparator`, `extractDomainsFromModifierList`, the
  packed-separator bit tricks, etc. — all of which duplicate agtree
  classifier logic, and at least one of which carries a
  "keep this in sync with AGTree" comment.
- Behavior notes to verify while doing it:
    - host rules: `getRuleParts` handles host detection itself
      (`ignoreHosts` toggle); the agtree kind enum does not distinguish host
      rules — that's what the candidate check is for;
    - comment/`!#` preprocessor lines and agent/metadata comments: currently
      dropped by `getRuleParts`; the classifier must produce the same
      "skip" outcome;
    - `[$modifier]##` prefixes and uBO/ABP pair separators must map onto the
      same categories the lookup tables expect today.
- Longer-term (optional, not required now): drive the whole engine build
  from agtree's `FilterListScanner` callbacks (`kind`, `ruleStart`,
  `ruleEnd`, ctx already provided), removing tsurlfilter's line readers and
  double line-splitting — but that is a bigger refactor of `IRuleList` /
  storage indexing, so explicitly out of scope for the "trivial pass".

### Explicitly out of scope for this pass

- DNR converter / anything that genuinely needs AST
  (`packages/dnr-converter` keeps consuming nodes).
- Lookup-table algorithm tuning (trie balancing, hashing changes).
- `Request`/`tldts` match-path work.
- Materialization strategy of `CosmeticLookupTable.genericRules` (full
  `CosmeticRule` objects are still cached at build time; with Tier 1 they
  simply become much cheaper to produce — a lazy variant can be a follow-up).

---

## 4. Validation plan

- `pnpm test:prod` in `packages/tsurlfilter` after each step (lint + smoke +
  full suite, per package AGENTS.md).
- Behavior parity checks worth extra attention:
    - error semantics — today a failed **AST** parse yields an
      `InvalidRule`/`Comment`/`Empty` node → `null` from `createRule`; the
      binary path must keep producing `null` (logged at debug) for the same
      inputs. The structural stage reports validation earlier (by design),
      so re-test the invalid-rule corpus;
    - priority/badfilter computation must be unaffected (`negatesBadfilter`,
      `isHigherPriority` rely only on already-extracted fields).
- Benchmarks: `packages/benchmarks/tsurlfilter-benchmark` (engine creation;
  current baseline on the dev machine: ~52 ms EasyList / ~105 ms AdGuard
  Base on Node 22, Apple M3 Max — see its `RESULTS.md`). Run before/after
  Tier 0, and again after Tier 1 per rule class.

---

## 5. Suggested implementation order

1. Tier 0 (1–3): shared pipeline + cached options; `FilterList.prepare`
   join; upstream `RawRuleConverter` hoist. — smallest diffs, immediate wins.
2. agtree prerequisite: decide Option A vs B readers, add the
   structural-parse entry point (+ host candidate check).
3. `NetworkRule` + `DomainModifier` binary path (biggest rule count in real
   lists; all fields already binary).
4. `CosmeticRule` / `HostRule` binary paths.
5. `getRuleParts` → adapter over the structural classifier; delete
   `rule-parts.ts` internals.
6. Re-run benchmarks; update tsurlfilter `CHANGELOG.md` (and agtree's, for
   the `RawRuleConverter` change); consider changelog entries in dependent
   packages (`tswebextension`, `api`, `api-mv3`) since options objects /
   constructor signatures may change.
