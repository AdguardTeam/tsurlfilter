# AGENTS.md

## Project Overview

`@adguard/agtree` is a universal adblock filter list parser that produces a
detailed Abstract Syntax Tree (AST). It supports parsing, generating,
converting, and validating filter rules across multiple adblocker syntaxes
(AdGuard, uBlock Origin, ABP, etc.). It also includes compatibility tables
and a rule converter for translating rules between syntaxes.

## Technical Context

- **Language/Version**: TypeScript (ESM-only output), Node.js ≥ 22
- **Primary Dependencies**: `@adguard/css-tokenizer` (CSS selector parsing),
  `zod` (schema validation), `tldts` (domain parsing), `is-ip`, `json5`,
  `sprintf-js`
- **Build Toolchain**: Rollup (with `@rollup/plugin-swc`), `tsc` + custom
  `transform-dts.ts` script for type declarations
- **Testing**: Vitest (with `@vitest/coverage-v8`)
- **Linting**: ESLint (airbnb-typescript base), `eslint-plugin-jsdoc`,
  markdownlint
- **Output Format**: ESM only (`dist/index.js`), type declarations
  (`dist/types/`)
- **Target Platform**: Node.js and browser environments
- **Project Type**: Package inside the `tsurlfilter` pnpm monorepo
- **Multiple export paths**: `.` (main), `./parser`, `./generator`,
  `./converter`, `./utils`

## Project Structure

```text
packages/agtree/
├── src/
│   ├── index.ts                # Main public API barrel
│   ├── version.ts              # Package version constant
│   ├── ast-utils/              # AST manipulation utilities
│   ├── common/                 # Shared constants and types
│   ├── compatibility-tables/   # Adblock syntax compatibility data
│   ├── converter/              # Rule converter (between syntaxes)
│   ├── errors/                 # Error types
│   ├── generator/              # AST-to-string code generator
│   ├── nodes/                  # AST node type definitions
│   ├── parser/                 # Filter rule parser
│   ├── tokenizer/              # Tokenizer utilities
│   ├── utils/                  # General utility functions
│   └── validator/              # Rule validator
├── test/                       # Unit tests + smoke tests
├── scripts/                    # Build scripts (build-txt, transform-dts, etc.)
├── typings/                    # Custom type declarations
├── dist/                       # Build output (gitignored)
├── rollup.config.ts            # Rollup build config
├── rollup.plugins.ts           # Shared Rollup plugin helpers
├── vitest.config.ts            # Vitest config
├── .eslintrc.cjs               # ESLint config
├── .markdownlint.json          # Markdownlint config
├── tsconfig*.json              # TypeScript configs (base, build, main)
└── package.json
```

## Build And Test Commands

- `pnpm build` — full build: clean, build metadata, build compatibility tables
  wiki, bundle via Rollup, emit types
- `pnpm test` — run unit tests via Vitest (no cache)
- `pnpm coverage` — run tests with V8 coverage
- `pnpm test:smoke` — run smoke tests (ESM import + exports validation)
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

- Since `@adguard/agtree` is a dependency of `@adguard/tsurlfilter`,
  `@adguard/tswebextension`, and `@adguard/dnr-rulesets`, consider updating
  their changelogs when making breaking or behavioral changes.

## Code Guidelines

### I. Architecture

1. **Multiple export paths.** The package exposes subpath exports for `parser`,
   `generator`, `converter`, and `utils` in addition to the main entry point.
   New public API MUST be exported through the appropriate barrel file.

   **Rationale**: Allows consumers to import only the functionality they need,
   enabling tree-shaking.

2. **Compatibility tables are data-driven.** The `src/compatibility-tables/`
   directory contains structured data describing which adblocker syntaxes
   support which features. This data is used by the converter and validator.

   **Rationale**: Centralizes syntax compatibility knowledge for consistent
   rule conversion and validation.

3. **Parser → AST → Generator round-trip.** The parser produces an AST that
   the generator can serialize back to a string. Round-trip fidelity is a
   design goal.

   **Rationale**: Enables lossless rule transformations and conversions.

### II. Code Quality Standards

1. **JSDoc is required** on all exported functions, classes, and types.

   **Rationale**: Enforced by `eslint-plugin-jsdoc`.

2. **TypeScript strict mode** is enabled. Code MUST compile cleanly under
   `pnpm lint:types`.

3. **Markdown files** MUST pass markdownlint checks (`pnpm lint:md`).

### III. Testing Discipline

1. **Smoke tests** validate that the published package can be imported as ESM
   and that all declared exports resolve correctly. Located in `test/smoke/`.

   **Rationale**: Catches packaging regressions before publishing.

2. **Coverage** is tracked via `@vitest/coverage-v8`. Run `pnpm coverage` to
   check.
