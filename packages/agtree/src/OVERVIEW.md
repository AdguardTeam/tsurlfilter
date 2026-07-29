# Parsing pipeline overview

The pipeline parser is structured as three sequential, allocation-free stages:

```text
source string
    │
    ▼
 Tokenizer          (src/tokenizer/)
    │  Tokenizer output — typed-array token stream (types, ends, tokenCount)
    ▼
 Parser             (src/parser/)
    │  ctx.data — flat Int32Array of source offsets
    ▼
 AST builder        (src/ast-builder/)
    │
    ▼
 AST node
```

All three stages share the same pre-allocated buffers that are reused across
calls. The only heap allocations that happen are in the final AST builder
stage, when AST objects and their `value` strings are created.

---

## Benefits & Design Rationale

### The Old Approach (Tokenizer → AST Parser)

Previously, the parser went directly from tokens to AST nodes:

```text
source → Tokenizer → AST Parser → AST node
                     ↑
                     allocates strings & objects immediately
```

**Problems:**

- **Wasteful allocations**: Every parse created strings and objects, even for rules you might filter out
- **No zero-copy classification**: Couldn't determine rule type without building the full AST
- **Memory pressure**: Parsing 100,000+ filter rules allocated millions of temporary objects
- **No structural validation**: Syntax errors only discovered during AST construction
- **Poor cache locality**: Scattered object allocations across heap

### Why the Structural Parser Layer?

The structural parser solves these problems by inserting a **zero-allocation structural analysis** stage
between tokenization and AST building:

```text
source → Tokenizer → Parser → AST builder → AST node
                     ↑          ↑
                     no alloc   only here
```

**Key Benefits:**

1. **Zero-copy rule classification**
   - Know rule type (Comment/Network/Cosmetic) without allocating
   - Can filter/skip rules before building AST
   - Essential for processing large filter lists efficiently

2. **Memory efficiency**
   - Stages 1-2 reuse the same buffers across all rules
   - Only allocate in stage 3, and only for rules you actually need
   - Reduces GC pressure by 10-100x for large filter lists

3. **Structural validation without allocation**
   - Catch syntax errors during parse (cheap)
   - Avoid building invalid ASTs (expensive)
   - Better error messages with source offsets ready

4. **Better cache locality**
   - Flat `Int32Array` buffer vs scattered heap objects
   - Sequential access patterns vs pointer chasing
   - V8 can optimize hot loops more aggressively

5. **Separation of concerns**
   - Tokenizer: character classification
   - Parser: structural boundaries
   - AST builder: semantic object construction
   - Each stage is simpler and easier to maintain

6. **Flexible consumption**
   - Some use cases only need classification (no AST needed)
   - Others need full AST for transformation
   - Parser stage enables both without waste

7. **Sub-range composition**
   - All structural parsers accept `(ctx, startTi, endTi, dataOffset)` params
   - Enables composing parsers over token sub-ranges without re-tokenizing
   - High-level parsers expose `parseRange()` for caller-supplied contexts

---

## 1. Tokenizer

**File:** `tokenizer/tokenizer.ts`

Scans the raw source string character-by-character and classifies spans into
token types (`Ident`, `Comma`, `OpenParen`, `Whitespace`, …).

Output is written into a caller-supplied `TokenizeResult`:

```typescript
TokenizeResult {
  tokenCount: number       — how many tokens were produced
  types:  Uint8Array       — TokenType per token
  ends:   Uint32Array      — exclusive source end of each token
}
```

Token **starts** are implicit: `token[i].start = token[i-1].end` (or 0 for
the first token). Storing only ends halves the memory required and the first
start is always derivable.

The same `TokenizeResult` object is reused across calls — both typed arrays
are overwritten in-place each time.

---

## 2. Structural Parser

**Files:** `parser/`

Walks the token stream and identifies the structural boundaries of a rule —
where the directive name starts, where parameters end, etc. — **without**
allocating strings or AST nodes.

Results are written into a flat `Int32Array` called `ctx.data`, using fixed
slot offsets that are defined per rule type as named constants.

### ParserContext

```typescript
ParserContext {
  source:     string       — original source string (read-only)
  types:      Uint8Array   — token types (from tokenizer)
  ends:       Uint32Array  — token ends  (from tokenizer)
  tokenCount: number
  data:       Int32Array   — output: structural indices
  status:     0 | 1 | 2    — 0 = success, 1 = capacity overflow (grow:false), 2 = hard-cap overflow
  maxDomains: number       — maximum domain records
  maxMods:    number       — maximum modifier records
}
```

A single `ParserContext` is created once and reused. `initParserContext`
rebinds the tokenizer arrays and clears `data` before each parse.

### ctx.data layout (example: preprocessor comment)

Each rule type reserves a fixed region of `ctx.data`. For example, a
`!#directive params` comment writes:

```text
data[0]  KIND          — CommentKind discriminator
data[1]  NAME_START    — source offset where directive name starts
data[2]  NAME_END      — source offset where directive name ends
data[3]  PARAMS_START  — source offset where params start (-1 if absent)
data[4]  PARAMS_END    — source offset where params end
```

Specialised directives share the remaining slots with an embedded sub-buffer.
For example, `!#if` embeds a flat logical-expression node tree starting at
`data[5]`, and `!#safari_cb_affinity` embeds a flat parameter-list at the
same offset (they are mutually exclusive, so they share the region).

### Parser API: `parse()` vs `parseRange()`

High-level parsers (`RuleParser`, `NetworkRuleParser`, `CommentRuleParser`)
expose two methods:

- **`parse(source, options?)`** — the common case. Tokenizes `source` and runs
  the full pipeline internally.
- **`parseRange(ctx, startTi, endTi, dataOffset, options?)`** — for callers
  that have already tokenized and want to parse a sub-range of tokens,
  optionally writing into a non-zero region of `ctx.data`.

All structural parser methods accept `(ctx, startTi?, endTi?, dataOffset?)`
with sensible defaults so existing call sites continue to work unchanged.

### Dispatcher chain

```text
RuleParser.parse(ctx, startTi?, endTi?, dataOffset?)
  └── RuleClassifier  →  Comment / Network / Cosmetic
        ├── CommentParser.parse(ctx, startTi?, endTi?, dataOffset?)
        │     └── dispatches to: SimpleCommentParser
        │                        PreprocessorCommentParser
        │                          └── LogicalExpressionParser  (!#if)
        │                          └── ParameterListParser      (!#safari_cb_affinity)
        │                        HintCommentParser
        │                        MetadataCommentParser
        │                        AgentCommentParser
        └── NetworkRuleParser.parse(ctx, startTi?, endTi?, dataOffset?)
              └── ModifierListParser
                    └── ModifierParser  (×N)
```

Each structural parser only reads tokens and writes integer offsets — no string
manipulation, no objects created.

---

## 3. AST Builder

**Files:** `ast-builder/`

Reads `ctx.data` (the pre-filled offset map) together with the original
source string and creates the final AST nodes. **This is the only stage where
string `slice()` is called** and new objects are heap-allocated.

```typescript
// Example — building a Value node from a parser slot:
const value: Value = {
    type: 'Value',
    value: source.slice(start, end),   // ← single allocation here
};
```

The dispatcher mirrors the structural parser:

```text
RuleParser.parse(source, options?)
  ├── kind === Comment  →  CommentAstBuilder
  │     └── dispatches on ctx.data[0] (CommentKind) to:
  │           SimpleCommentAstBuilder
  │           PreprocessorCommentAstBuilder
  │             └── LogicalExpressionAstBuilder  (!#if)
  │             └── ParameterListAstBuilder       (!#safari_cb_affinity)
  │           HintCommentAstBuilder
  │           MetadataCommentAstBuilder
  │           AgentCommentAstBuilder
  └── kind === Network  →  NetworkRuleAstBuilder
        └── ModifierListAstBuilder
              └── ModifierAstBuilder (×N)
```

---

## How the three stages fit together

```typescript
// Allocate once, reuse forever — done internally by RuleParser constructor
const parser = new RuleParser({ tokenCapacity: 1024, itemCapacity: 64 });

// Per rule (hot path — no allocations until stage 3)
const ast = parser.parse(source, options);   // all three stages run inside
```

For advanced callers that need manual control over the pipeline:

```typescript
import { Tokenizer } from './tokenizer/tokenizer';
import { createParserContext, initParserContext } from './parser/context';
import { RuleParser, RuleKind } from './parser/rule';
import { CommentAstBuilder } from './ast-builder/comment/comment';

// Allocate once
const tokenizer = new Tokenizer(1024);
const ctx = createParserContext(1024, 64);

// Per rule
tokenizer.setSource(source);                    // stage 1: tokenize
initParserContext(ctx, source, tokenizer);       // bind tokenizer output
const kind = RuleParser.parse(ctx);            // stage 2: structural parse
if (kind === RuleKind.Comment) {
    const ast = CommentAstBuilder.parse(source, ctx.data, options); // stage 3
}
```

The `RuleParserPipeline` class wraps this loop and owns the reusable buffers, so
callers only see a single `parse(source)` method.

---

## Design Rules

These invariants apply to every parser in this package. AI agents and new
contributors **must** follow all of them when adding or modifying parsers.

1. **Zero heap allocation in stages 1 and 2.**
   The tokenizer and structural parser stages MUST NOT call `new`, allocate
   arrays, or produce strings. All output goes into the pre-allocated
   `ctx.data` buffer.

2. **Buffers grow on demand up to a hard cap.**
   Buffers are allocated at construction with a caller-chosen capacity. If a
   rule exceeds the buffer and `grow` is `true` (the default), `growCtxRegion`
   doubles the affected region up to the hard cap defined in `src/limits.ts`.
   When the hard cap is reached `ctx.status = 2` and `ctx.overflowRegion` are
   set; the pipeline parser then throws `CapacityOverflowError`. When
   `grow: false`, the old behaviour is preserved: `ctx.status = 1` is set and a
   generic error is thrown.

3. **No static singletons for pipeline parsers.**
   Classes that own a `Tokenizer` and `ParserContext` (`RuleParser`,
   `NetworkRuleParser`, `CommentRuleParser`, `SelectorListParser`,
   `DeclarationListParser`, `CssRuleParser`) MUST be instance-based. Static
   `readonly tokenizer` / `readonly ctx` fields are forbidden on these
   classes.

4. **Capacity overflow signals via `ctx.status`, not exceptions.**
   When the number of records exceeds the allocated capacity (e.g., too many
   domains or modifiers), structural parsers call `growCtxRegion(ctx, region,
   newCap)` if `ctx.grow` is `true`. On success parsing continues normally. If
   growth is disabled or the hard cap is reached, set `ctx.status = 1` or `2`
   (respectively) and return immediately. Pipeline parsers inspect `ctx.status`
   after each structural parse and throw accordingly — `CapacityOverflowError`
   for `status === 2`, a generic `Error` for `status === 1`.

5. **Options objects are immutable pass-throughs.**
   No parser or builder may mutate the `options` argument. Pass it by
   reference to sub-parsers and sub-builders as-is.

6. **Structural parsers and pipeline parsers both use `parse()` / `parseRange()`.**
   - Structural parsers (in `src/parser/`): `static parse(ctx, startTi?,
     endTi?, dataOffset?)` — zero allocation, writes to `ctx.data`.
   - Pipeline parsers (in `src/ast-builder/`): `parse(source, options?)` and
     `parseRange(ctx, startTi, endTi, dataOffset, options?)`.

7. **Every structural parser exposes `MIN_DATA_SLOTS`.**
   `public static readonly MIN_DATA_SLOTS: number` — the minimum
   `ctx.data.length` needed to call `parse()` with the default capacity.
   Callers use this constant when pre-sizing a shared buffer for sub-range
   composition.

---

## Pipeline Parser vs AST Builder

The three-stage pipeline has two consumer-facing tiers:

| | Pipeline Parser (Tier 1) | AST Builder (Tier 2) |
|---|---|---|
| Location | `src/ast-builder/*-parser.ts` | `src/ast-builder/*/` (non-parser files) |
| Owns buffers | ✅ yes — `Tokenizer` + `ParserContext` | ❌ no — reads caller-provided buffers |
| Entry point | `parse(source, options?)` | static methods: `parse(source, data, ...)` |
| Allocates | Yes — stage 3 only (AST nodes, strings) | Yes — AST nodes, strings |
| Also exposes | `parseRange(ctx, startTi, endTi, dataOffset, options?)` | — |
| Example | `RuleParser`, `NetworkRuleParser` | `NetworkRuleAstBuilder`, `CommentAstBuilder` |

**Decision guide:**

- *"I have a source string and want an AST node."* → **use a pipeline parser**
  (`new RuleParser().parse(source)`).
- *"I have an already-tokenized context and want to avoid re-tokenizing."* →
  **use `parseRange()`** on a pipeline parser.
- *"I have `ctx.data` already filled and just want to materialize the AST."* →
  **call the AST builder directly** (e.g., `NetworkRuleAstBuilder.parse(source,
  ctx.data, 0, options)`).

---

## Canonical API Patterns

### `ParserCapacity` — pipeline parser constructors

```typescript
interface ParserCapacity {
    tokenCapacity?:     number;   // max tokens per rule    (default 1024)
    itemCapacity?:      number;   // max primary records    (default varies)
    secondaryCapacity?: number;   // max secondary records  (default varies)
    grow?:              boolean;  // auto-grow buffers up to hard cap (default true)
}

// Usage:
const parser = new RuleParser({ tokenCapacity: 2048, itemCapacity: 128 });
// Disable auto-growth (legacy behaviour — throws on overflow):
const strictParser = new RuleParser({ grow: false });
```

### `reset()` — release grown memory

After parsing a large rule, call `parser.reset()` to shrink all buffers back
to their construction-time defaults and release any memory acquired by
auto-growth:

```typescript
const parser = new RuleParser();   // default capacities
parser.parse(massiveRule);         // buffers may have grown
parser.reset();                    // shrink back & free grown memory
parser.parse(smallRule);           // next parse starts with compact buffers
```

### `ParseOptions` — parse-time flags

```typescript
interface ParseOptions {
    isLocIncluded?:          boolean;  // include source locations in AST
    parseUboSpecificRules?:  boolean;  // parse uBO-only syntax
    parseAbpSpecificRules?:  boolean;  // parse ABP-only syntax
}
```

### `parse(source, options?)` — full pipeline entry point

```typescript
// Pipeline parser — owns tokenizer + context
const parser = new NetworkRuleParser();
const ast: NetworkRule = parser.parse('||example.com^$script', { isLocIncluded: true });
```

### `parseRange(ctx, startTi, endTi, dataOffset, options?)` — sub-range entry point

```typescript
// Caller has already tokenized and wants to re-use the context
const ast: SelectorList = selectorParser.parseRange(ctx, startTi, endTi, 0, options);
```

### `parse(ctx, startTi?, endTi?, dataOffset?, ...)` — structural parser signature

```typescript
// Structural parser — zero allocation, writes integer offsets to ctx.data
NetworkRuleParser.parse(ctx);                             // full range
NetworkRuleParser.parse(ctx, 3, 15, 0);                   // sub-range
```

### AST builder `parse(source, data, dataOffset, ...)` signature

```typescript
// AST builder — reads ctx.data, allocates AST nodes
const ast = NetworkRuleAstBuilder.parse(source, ctx.data, 0, options);
```

---

## Buffer Layout

All structural parsers share a single `Int32Array` (`ctx.data`) that is
divided into regions. Understanding this layout is essential for composing
sub-parsers (e.g., `CssRuleParser` calling `SelectorListParser`).

### The `ctx.data` region map (default capacities)

```text
Offset   Size    Region
──────────────────────────────────────────────────────────────────────
0        5       Network rule header (NR_*)
                 — OR — CR header for cosmetic rules (CR_*, 6 slots)
5        320     Network modifier records (64 modifiers × stride 5)
                 — OR — uBO modifier records for element-hiding rules
                    (4 modifiers × stride 7 = 28 slots, fits in [6..33])
453      384     Domain records (128 domains × stride 3)
837      128     Scriptlet body data
──────────────────────────────────────────────────────────────────────
Total    965     default ctx.data.length
```

Network rules and cosmetic rules are mutually exclusive, so their header and
modifier regions safely overlap.

### Header + records + stride pattern

Every structural parser with variable-length output follows:

```text
data[dataOffset + 0]            ← kind / flags (header field 0)
data[dataOffset + 1..H-1]       ← remaining header fields
data[dataOffset + H + i*STRIDE] ← start of record i
data[dataOffset + H + i*STRIDE + FIELD] ← specific field of record i
```

Where `H` is the header size (number of fixed slots before the first record)
and `STRIDE` is the number of slots per record.

### `MIN_DATA_SLOTS` convention

Every structural parser class exposes:

```typescript
public static readonly MIN_DATA_SLOTS: number;
// = HEADER_SIZE + DEFAULT_MAX_RECORDS * STRIDE
```

Use this when verifying that a caller-supplied buffer is large enough before
calling `parse()` at a given `dataOffset`:

```typescript
if (ctx.data.length - dataOffset < NetworkRuleParser.MIN_DATA_SLOTS) {
    throw new Error('Buffer too small');
}
```

### `dataOffset` for sub-parser composition

When a pipeline parser embeds a sub-parser, it passes a non-zero `dataOffset`
so each sub-parser writes into its own slice of `ctx.data`:

```typescript
// CssRuleParser embeds SelectorListParser at a fixed sub-offset:
SelectorListParser.parse(ctx, bodyStartTi, bodyEndTi, dataOffset + SL_DATA_OFFSET, maxComplex);
// Then embeds DeclarationListParser at a different offset:
DeclarationListParser.parse(ctx, bodyStartTi, bodyEndTi, dataOffset + DL_DATA_OFFSET, maxDecl);
```

Each sub-parser region is non-overlapping. The parent is responsible for
computing correct offsets and ensuring the total buffer is large enough
(`CR_MIN_DATA_SLOTS` covers the combined maximum).

---

## How to Add a New Rule Type

Follow these steps to add a new rule kind (e.g., a `FooRule`) to the
three-stage pipeline.

### Step 1: Define data layout constants

Create `src/parser/foo/constants.ts`:

```typescript
// Header fields
export const FOO_KIND_OFFSET = 0;
export const FOO_FIELD_A_OFFSET = 1;
export const FOO_HEADER_SIZE = 2;

// Record fields (if variable-length)
export const FOO_RECORD_STRIDE = 3;
export const FOO_DEFAULT_MAX_RECORDS = 32;
export const FOO_MIN_DATA_SLOTS =
    FOO_HEADER_SIZE + FOO_DEFAULT_MAX_RECORDS * FOO_RECORD_STRIDE;
```

### Step 2: Create the structural parser

Create `src/parser/foo/foo.ts`:

```typescript
import type { ParserContext } from '../context';
import { FOO_HEADER_SIZE, FOO_MIN_DATA_SLOTS, FOO_RECORD_STRIDE } from './constants';

export class FooParser {
    public static readonly MIN_DATA_SLOTS = FOO_MIN_DATA_SLOTS;

    public static parse(
        ctx: ParserContext,
        startTi = 0,
        endTi = ctx.tokenCount,
        dataOffset = 0,
    ): void {
        // Write to ctx.data[dataOffset + FOO_*] — zero allocations
    }
}
```

### Step 3: Register in the dispatcher

In `src/parser/rule.ts`, add a `RuleKind.Foo` branch inside
`RuleParser.parse()` and call `FooParser.parse(ctx, startTi,
endTi, dataOffset)`.

In `src/parser/classifier.ts`, extend `RuleClassifier.classify()` to detect
the new separator/prefix and return the new `RuleKind`.

### Step 4: Create the AST builder

Create `src/ast-builder/foo/foo.ts`:

```typescript
import type { ParseOptions } from '../options';
import type { FooRule } from '../../ast/types';
import { FOO_FIELD_A_OFFSET, FOO_HEADER_SIZE, FOO_RECORD_STRIDE } from '../../parser/foo/constants';

export class FooAstBuilder {
    public static parse(
        source: string,
        data: Int32Array,
        dataOffset: number,
        options?: ParseOptions,
    ): FooRule {
        const fieldA = data[dataOffset + FOO_FIELD_A_OFFSET];
        // Read from data[] + source.slice() → construct AST node
    }
}
```

### Step 5: Create the pipeline parser

Create `src/ast-builder/foo/foo-parser.ts`:

```typescript
import type { ParserCapacity } from '../capacity';
import type { ParseOptions } from '../options';
import { Tokenizer } from '../../tokenizer/tokenizer';
import { createParserContext, initParserContext } from '../../parser/context';
import { FooParser } from '../../parser/foo/foo';
import { FooAstBuilder } from './foo';
import type { FooRule } from '../../ast/types';

const DEFAULT_TOKEN_CAPACITY = 1024;
const DEFAULT_ITEM_CAPACITY = 32;

export class FooPipelineParser {
    private tokenizer: Tokenizer;
    private ctx: ReturnType<typeof createParserContext>;

    constructor(capacity?: ParserCapacity) {
        const tokenCap = capacity?.tokenCapacity ?? DEFAULT_TOKEN_CAPACITY;
        const itemCap = capacity?.itemCapacity ?? DEFAULT_ITEM_CAPACITY;
        this.tokenizer = new Tokenizer(tokenCap);
        this.ctx = createParserContext(tokenCap, itemCap);
    }

    public parse(source: string, options?: ParseOptions): FooRule {
        const { tokenizer, ctx } = this;
        tokenizer.setSource(source);
        initParserContext(ctx, source, tokenizer);
        FooParser.parse(ctx);
        return FooAstBuilder.parse(source, ctx.data, 0, options);
    }

    public parseRange(
        ctx: typeof this.ctx,
        startTi: number,
        endTi: number,
        dataOffset: number,
        options?: ParseOptions,
    ): FooRule {
        FooParser.parse(ctx, startTi, endTi, dataOffset);
        return FooAstBuilder.parse(ctx.source, ctx.data, dataOffset, options);
    }
}
```

### Step 6: Export from barrel files

- Add to `src/ast-builder/index.ts`: export `FooPipelineParser` and `FooAstBuilder`.
- Add to `src/index.ts`: re-export `FooParser`.

### Step 7: Add tests

- `test/parser/foo/foo.test.ts` — structural parser unit tests.
- `test/ast-builder/foo/foo-parser.test.ts` — pipeline parser tests including
  `parseRange()`.

