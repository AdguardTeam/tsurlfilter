# AGENTS.md

## Project Overview

`@adguard/css-tokenizer` is a fast, spec-compliant CSS tokenizer that supports
both standard CSS (per the [CSS Syntax Level 3][css-syntax] specification) and
AdGuard's Extended CSS syntax. It is used by `@adguard/agtree` and
`@adguard/tsurlfilter` for parsing CSS selectors in filter rules.

[css-syntax]: https://www.w3.org/TR/css-syntax-3/

## Technical Context

- **Language/Version**: TypeScript, Node.js ≥ 22
- **Build Toolchain**: Rollup (with `@rollup/plugin-typescript`,
  `@rollup/plugin-terser`), `rollup-plugin-dts` (type bundling)
- **Testing**: Vitest (with `@vitest/coverage-v8`)
- **Linting**: ESLint (airbnb-typescript base), `eslint-plugin-jsdoc`,
  markdownlint
- **Output Formats**: CJS (`dist/csstokenizer.js`), ESM
  (`dist/csstokenizer.mjs`), bundled type declarations
  (`dist/csstokenizer.d.ts`)
- **Target Platform**: Node.js and browser environments
- **Project Type**: Package inside the `tsurlfilter` pnpm monorepo
- **Internal Dependencies**: None (independent leaf package)

## Project Structure

```text
packages/css-tokenizer/
├── src/
│   ├── index.ts                  # Public API barrel
│   ├── css-tokenizer.ts          # Standard CSS tokenizer
│   ├── extended-css-tokenizer.ts # Extended CSS tokenizer
│   ├── algorithms/               # Tokenization algorithms (consume functions)
│   ├── common/                   # Shared constants and types
│   └── utils/                    # Utility helpers
├── test/                         # Unit tests + smoke tests (esm, cjs, typescript)
├── scripts/                      # Build helper scripts (build-txt)
├── dist/                         # Build output (gitignored)
├── rollup.config.ts              # Rollup build config
├── vitest.config.ts              # Vitest config
├── .eslintrc.js                  # ESLint config
├── .markdownlint.json            # Markdownlint config
├── tsconfig*.json                # TypeScript configs (base, build, main)
└── package.json
```

## Build And Test Commands

- `pnpm build` — full build: clean dist, build metadata, bundle via Rollup,
  remove intermediate types
- `pnpm test` — run unit tests via Vitest
- `pnpm test:coverage` — run tests with V8 coverage
- `pnpm test:smoke` — run smoke tests (ESM, CJS, TypeScript imports)
- `pnpm lint` — run ESLint, TypeScript type checking, and markdownlint
- `pnpm lint:code` — run ESLint only
- `pnpm lint:types` — run TypeScript type checking only
- `pnpm lint:md` — run markdownlint only

## Contribution Instructions

You MUST follow the following rules for EVERY task that you perform:

- You MUST verify your changes pass `pnpm lint` (ESLint + type checking +
  markdownlint) before completing a task.

- You MUST run `pnpm test` to verify your changes do not break existing
  functionality.

- When the task is finished, update `CHANGELOG.md` in the `Unreleased`
  section. Add entries to the appropriate subsection (`Added`, `Changed`, or
  `Fixed`); do not create duplicate subsections.

- Since `@adguard/css-tokenizer` is a dependency of `@adguard/agtree` and
  `@adguard/tsurlfilter`, consider updating their changelogs when making
  breaking or behavioral changes.

## Code Guidelines

### I. Architecture

1. **Two tokenizer implementations.** The package provides a standard CSS
   tokenizer (`css-tokenizer.ts`) and an Extended CSS tokenizer
   (`extended-css-tokenizer.ts`) that extends it with AdGuard-specific syntax.

   **Rationale**: Keeps standard CSS tokenization spec-compliant while
   supporting Extended CSS as a superset.

2. **Algorithmic structure mirrors the CSS spec.** Files in `src/algorithms/`
   correspond to "consume" functions defined in the CSS Syntax specification.

   **Rationale**: Makes it easy to verify correctness against the spec.

3. **Single bundled type declaration.** Types are bundled into a single `.d.ts`
   file via `rollup-plugin-dts`.

   **Rationale**: Simplifies consumption and avoids exposing internal types.

### II. Code Quality Standards

1. **JSDoc is required** on all exported functions, classes, and types.

   **Rationale**: Enforced by `eslint-plugin-jsdoc`.

2. **TypeScript strict mode** is enabled. Code MUST compile cleanly under
   `pnpm lint:types`.

3. **Markdown files** MUST pass markdownlint checks (`pnpm lint:md`).

### III. Testing Discipline

1. **Smoke tests** validate that the published package can be imported as ESM,
   CJS, and via TypeScript. Located in `test/smoke/`.

   **Rationale**: Catches packaging regressions before publishing.

2. **Coverage** is tracked via `@vitest/coverage-v8`. Run `pnpm test:coverage`
   to check.
