# `src/parser/` — Structural Parser Pipeline

This folder contains the **new pipeline parser** for adblock filter rules.
It is a token-driven, zero-heap-allocation parser that produces a compact
`Int32Array` data layout consumed by the AST builders in
[`../ast-builder/`](../ast-builder/).

## Folder layout

```text
src/parser/
├── README.md                 ← (this file)
├── index.ts                  ← public re-exports
├── types.ts                  ← parser contract marker interfaces
├── options.ts                ← RuleParserOptions + resolver
├── context.ts                ← ParserContext (shared Int32Array buffer)
├── classifier.ts             ← top-level rule kind dispatch
├── rule.ts                   ← RuleParser entry point
├── cosmetic-separator.ts     ← cosmetic separator token scan
├── comment/                  ← comment + classifier sub-parsers
├── cosmetic/                 ← element-hiding, CSS/JS/scriptlet/HTML body parsers
├── css/                      ← selector list + declaration list pipelines
├── network/                  ← network rule structural parser
└── misc/                     ← modifier list, parameter list, etc.
```

## Parser contracts (`types.ts`)

Parsers expose **static `parse(...)` methods** rather than instance
methods. Because TypeScript's `implements` clause only validates instance
members, the contract types in [`types.ts`](./types.ts) are intentionally
**empty marker interfaces**. Each contract documents (in JSDoc) the
required static shape, and a regex-based test in
`test/parser/contract-coverage.test.ts` verifies that every parser class
declares one of the contracts via `implements`.

The contracts are:

| Contract              | Purpose                                                                   |
| --------------------- | ------------------------------------------------------------------------- |
| `RootParser`          | Top-level entry parsers (`RuleParser`)                                    |
| `StructuralParser`    | Parsers writing rule data into `ctx.data`                                 |
| `CosmeticBodyParser`  | Cosmetic-rule body parsers (scriptlet body, declaration list, …)          |
| `CursorParser`        | Token-cursor based sub-parsers                                            |
| `BufferedParser`      | Parsers operating on a sub-range of tokens                                |
| `RecordParser`        | Parsers that emit fixed-stride records (modifier list, domain list, …)    |

## Options resolution (`options.ts`)

All public entry points accept an optional `RuleParserOptions` object.
The `resolveRuleParserOptions(options?)` helper merges user-supplied
options with `DEFAULT_RULE_PARSER_OPTIONS`. Internal parsers receive
already-resolved options to avoid scattering default values across the
codebase.

## Status semantics (`context.ts`)

`ParserContext.status` is the single source of truth for parser outcomes:

| Value | Meaning                                                                                            |
| :---: | -------------------------------------------------------------------------------------------------- |
| `0`   | **Success.** `ctx.data` is populated and ready for AST building.                                   |
| `1`   | **Recoverable overflow.** A capacity limit was hit. See note below.                                |

When `ctx.status === 1`, a capacity limit (e.g. parameter, declaration or
selector cap) was reached. The parser has written enough state to let
callers surface a precise error; the rule is **not** valid and MUST NOT
be turned into an AST. The pipeline (`rule.ts`) translates this into an
`Error('Parser data buffer overflow: rule too large for current capacity')`.

Parsers MUST set `ctx.status = 1` on overflow rather than throwing —
this lets the surrounding pipeline decide how to react (re-attempt with
larger capacity, log, skip, …).

## Zero-heap-allocation invariant

Apart from a handful of well-defined hot-path locals, parsers MUST NOT
allocate during the structural parse:

- All record state lives in `ctx.data` (an `Int32Array`).
- Identifier matching uses `regionEquals` / `regionEqualsCI` to avoid
  building temporary strings.
- AST allocation is deferred to `src/ast-builder/`.

See [`../../AGENTS.md`](../../AGENTS.md) for the package-wide
contribution rules.
