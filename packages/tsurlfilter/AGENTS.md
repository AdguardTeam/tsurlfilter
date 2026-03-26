# AGENTS.md

## Project Overview

`@adguard/tsurlfilter` is the core content blocking engine for AdGuard browser
extensions. It parses AdGuard filter rules, builds lookup tables for fast
matching, and evaluates network requests and cosmetic rules against those
tables. It also includes a declarative converter for translating filter rules
to Chrome's Declarative Net Request (DNR) format, and a CLI for filter
conversion tasks.

## Technical Context

- **Language/Version**: TypeScript (ESM-only primary output), Node.js ≥ 22
- **Primary Dependencies**: `@adguard/agtree` (rule parsing),
  `@adguard/css-tokenizer` (CSS parsing), `@adguard/logger` (logging),
  `@adguard/scriptlets` (scriptlet injection), `zod` (schema validation),
  `tldts` (domain parsing), `lru-cache`, `commander` (CLI)
- **Peer Dependencies**: `@adguard/re2-wasm` (optional RE2 regex engine)
- **Build Toolchain**: Rollup (with `@rollup/plugin-typescript`), `tsc` +
  custom `transform-dts.ts` for type declarations
- **Testing**: Vitest (with `@vitest/coverage-v8`)
- **Linting**: ESLint (airbnb-typescript base), `eslint-plugin-jsdoc`,
  `eslint-plugin-boundaries`
- **Output Formats**: ESM (`dist/es/`), UMD (`dist/tsurlfilter.umd.js`),
  IIFE (`dist/tsurlfilter.iife.js`), type declarations (`dist/types/`)
- **Target Platform**: Node.js and browser environments
- **Project Type**: Package inside the `tsurlfilter` pnpm monorepo

## Project Structure

```text
packages/tsurlfilter/
├── src/
│   ├── index.ts              # Main public API barrel
│   ├── request.ts            # Request abstraction
│   ├── request-type.ts       # Request type enum
│   ├── configuration.ts      # Engine configuration schema
│   ├── filtering-log.ts      # Filtering log interface
│   ├── common/               # Shared constants and types
│   ├── engine/               # Matching engine (network, cosmetic, DNS)
│   │   ├── engine.ts         # Main Engine class
│   │   ├── matching-result.ts # MatchingResult aggregation
│   │   ├── network-engine.ts # Network rule matching
│   │   ├── dns-engine.ts     # DNS rule matching
│   │   ├── cosmetic-engine/  # Cosmetic rule matching
│   │   └── lookup-tables/    # Fast lookup data structures
│   ├── filterlist/           # Filter list loading and management
│   ├── modifiers/            # Network rule modifier implementations
│   ├── rules/                # Rule classes and declarative converter
│   └── utils/                # Utility functions
├── cli/                      # CLI entry point and commands
├── test/                     # Unit tests + smoke tests + builder tests
├── tasks/                    # Build scripts (build-txt, transform-dts, etc.)
├── types/                    # Custom type declarations
├── dist/                     # Build output (gitignored)
├── rollup.config.ts          # Rollup build config
├── vitest.config.ts          # Vitest config
├── .eslintrc.cjs             # ESLint config
├── tsconfig*.json            # TypeScript configs (base, build, main)
└── package.json
```

## Build And Test Commands

- `pnpm build` — full build: clean dist, emit types, bundle via Rollup, build
  metadata
- `pnpm test` — run unit tests via Vitest
- `pnpm test:light` — run tests excluding benchmarks
- `pnpm test:coverage` — run tests with V8 coverage
- `pnpm test:smoke` — run smoke tests (Rollup builder integration test)
- `pnpm test:prod` — **full validation**: lint + smoke tests + full test suite
  (no cache). Run this before submitting changes.
- `pnpm lint` — run ESLint and TypeScript type checking
- `pnpm lint:code` — run ESLint only
- `pnpm lint:types` — run TypeScript type checking only

## Contribution Instructions

You MUST follow the following rules for EVERY task that you perform:

- You MUST build the package first (`pnpm build`), then run `pnpm test:prod`
  which includes lint, smoke tests, and the full test suite.

- You MUST verify your changes pass `pnpm lint` before completing a task.

- You MUST run `pnpm test` to verify your changes do not break existing
  functionality.

- When the task is finished, update `CHANGELOG.md` in the `Unreleased`
  section. Add entries to the appropriate subsection (`Added`, `Changed`, or
  `Fixed`); do not create duplicate subsections.

- Since `@adguard/tsurlfilter` is a dependency of `@adguard/tswebextension`,
  `@adguard/dnr-rulesets`, `@adguard/api`, and `@adguard/api-mv3`, consider
  updating their changelogs when making breaking or behavioral changes.

## Code Guidelines

### I. Architecture

1. **Multiple export paths.** The package exposes subpath exports for
   `declarative-converter`, `request-type`, `network-rule-options`,
   `simple-regex`, `declarative-converter-utils`, and `cli`. New public API
   MUST be exported through the appropriate barrel file.

   **Rationale**: Allows consumers to import specific functionality without
   pulling in the entire engine.

2. **Engine is the central abstraction.** The `Engine` class in
   `src/engine/engine.ts` orchestrates network, cosmetic, and DNS rule
   matching. Filter lists are loaded via the `filterlist/` module and indexed
   into lookup tables.

   **Rationale**: Separates concerns between rule storage, indexing, and
   matching.

3. **Declarative converter is self-contained.** The `src/rules/` directory
   contains the declarative converter for translating filter rules to DNR
   format, used by `@adguard/dnr-rulesets`.

   **Rationale**: Keeps DNR conversion logic co-located with rule
   representation.

4. **CLI is a separate entry point.** The `cli/` directory provides a
   `commander`-based CLI for filter conversion tasks, shipped as a separate
   export.

   **Rationale**: Keeps CLI code out of the library bundle.

### II. Code Quality Standards

1. **JSDoc is required** on all exported classes, methods, and functions.

   **Rationale**: Enforced by `eslint-plugin-jsdoc`.

2. **TypeScript strict mode** is enabled. Code MUST compile cleanly under
   `pnpm lint:types`.

3. **Module boundary enforcement** via `eslint-plugin-boundaries` ensures
   proper layering between engine, rules, filterlist, and other modules.

### III. Testing Discipline

1. **Smoke tests** validate that the published package can be consumed via
   Rollup with TypeScript. Located in `test/builders/rollup-ts/`.

   **Rationale**: Catches packaging and bundling regressions.

2. **Coverage** is tracked via `@vitest/coverage-v8`. Run
   `pnpm test:coverage` to check.

3. **`test:prod` is the gate.** Always run `pnpm test:prod` before
   considering a change complete. It combines lint, smoke tests, and the full
   test suite with no cache.
