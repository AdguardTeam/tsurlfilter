# Parsing pipeline overview

The new parser is structured as three sequential, allocation-free stages:

```text
source string
    │
    ▼
 Tokenizer          (src/tokenizer/)
    │  TokenizeResult — typed-array token stream
    ▼
 Preparser          (src/preparser/)
    │  ctx.data — flat Int32Array of source offsets
    ▼
 AST parser         (src/parser-new/)
    │
    ▼
 AST node
```

All three stages share the same pre-allocated buffers that are reused across
calls. The only heap allocations that happen are in the final AST stage, when
AST objects and their `value` strings are created.

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

### Why the Preparser Layer?

The preparser solves these problems by inserting a **zero-allocation structural analysis** stage between tokenization
and AST building:

```text
source → Tokenizer → Preparser → AST Parser → AST node
                     ↑            ↑
                     no alloc     only here
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
   - Catch syntax errors during preparse (cheap)
   - Avoid building invalid ASTs (expensive)
   - Better error messages with source offsets ready

4. **Better cache locality**
   - Flat `Int32Array` buffer vs scattered heap objects
   - Sequential access patterns vs pointer chasing
   - V8 can optimize hot loops more aggressively

5. **Separation of concerns**
   - Tokenizer: character classification
   - Preparser: structural boundaries
   - AST parser: semantic object construction
   - Each stage is simpler and easier to maintain

6. **Flexible consumption**
   - Some use cases only need classification (no AST needed)
   - Others need full AST for transformation
   - Preparser enables both without waste

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

## 2. Preparser

**Files:** `preparser/`

Walks the token stream and identifies the structural boundaries of a rule —
where the directive name starts, where parameters end, etc. — **without**
allocating strings or AST nodes.

Results are written into a flat `Int32Array` called `ctx.data`, using fixed
slot offsets that are defined per rule type as named constants.

### PreparserContext

```typescript
PreparserContext {
  source:     string       — original source string (read-only)
  types:      Uint8Array   — token types (from tokenizer)
  ends:       Uint32Array  — token ends  (from tokenizer)
  tokenCount: number
  data:       Int32Array   — output: structural indices
}
```

A single `PreparserContext` is created once and reused. `initPreparserContext`
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

### Dispatcher chain

```text
RulePreparser.preparse(ctx)
  └── RuleClassifier  →  Comment / Network / Cosmetic
        ├── CommentClassifier.preparse(ctx)
        │     └── dispatches to: SimpleCommentPreparser
        │                        PreprocessorCommentPreparser
        │                          └── LogicalExpressionPreparser  (!#if)
        │                          └── ParameterListPreparser      (!#safari_cb_affinity)
        │                        HintPreparser
        │                        MetadataPreparser
        │                        AgentPreparser
        └── NetworkRulePreparser.preparse(ctx)
              └── ModifierListPreparser
                    └── ModifierPreparser  (×N)
```

Each preparser only reads tokens and writes integer offsets — no string
manipulation, no objects created.

---

## 3. AST parser

**Files:** `parser-new/`

Reads `ctx.data` (the pre-filled offset map) together with the original
source string and creates the final AST nodes. **This is the only stage where
string `slice()` is called** and new objects are heap-allocated.

```typescript
// Example — building a Value node from a preparser slot:
const value: Value = {
    type: 'Value',
    value: source.slice(start, end),   // ← single allocation here
};
```

The dispatcher mirrors the preparser:

```text
RuleParser.parse(ctx, kind, options)
  ├── kind === Comment  →  CommentAstParser
  │     └── dispatches on ctx.data[0] (CommentKind) to:
  │           SimpleCommentAstParser
  │           PreprocessorCommentAstParser
  │             └── LogicalExpressionAstParser  (!#if)
  │             └── ParameterListAstParser       (!#safari_cb_affinity)
  │           HintAstParser
  │           MetadataAstParser
  │           AgentAstParser
  └── kind === Network  →  NetworkRuleAstParser
        └── ModifierListAstParser
              └── ModifierAstParser (×N)
```

---

## How the three stages fit together

```typescript
// Allocate once, reuse forever
const tokens: TokenizeResult = { tokenCount: 0, types: new Uint8Array(1024), ends: new Uint32Array(1024), ... };
const ctx = createPreparserContext();
const parser = new RuleParser();

// Per rule (hot path — no allocations until stage 3)
tokenizeLine(source, 0, tokens);           // stage 1: fill tokens
initPreparserContext(ctx, source, tokens); // bind to ctx
const kind = RulePreparser.preparse(ctx);  // stage 2: fill ctx.data
const ast  = parser.parse(ctx, kind, {}); // stage 3: build AST
```

The `RuleParser` class wraps this loop and owns the reusable buffers, so
callers only see a single `parse(source)` method.
