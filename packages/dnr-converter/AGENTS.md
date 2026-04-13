# AGENTS.md

## Project Overview

`@adguard/dnr-converter` converts adblock-style filtering rules into rules
compatible with Chrome's Declarative Net Request (DNR) API. It supports
converting both static rulesets (for extension assembly) and dynamic rules
(on-the-fly conversion at runtime).

## Technical Context

- **Language/Version**: TypeScript (ESM-only output), Node.js ≥ 22
- **Primary Dependencies**: `@adguard/agtree` (rule parsing),
  `@adguard/logger` (logging), `@adguard/scriptlets` (scriptlet injection),
  `valibot` (schema validation), `punycode` (IDN encoding)
- **Peer Dependencies**: `@adguard/re2-wasm` (RE2 regex engine for rule
  validation)
- **Build Toolchain**: Rollup (with `@rollup/plugin-swc`), `rollup-plugin-dts`
  for type declarations
- **Testing**: Vitest (with `@vitest/coverage-v8`)
- **Linting**: ESLint (airbnb-typescript base), `eslint-plugin-jsdoc`,
  `eslint-plugin-boundaries`
- **Output Format**: ESM (`dist/`), type declarations (`dist/types/`)
- **Target Platform**: Browser extensions (MV3 DNR API), Node.js tooling
- **Project Type**: Package inside the `tsurlfilter` pnpm monorepo

## Project Structure

```text
packages/dnr-converter/
├── src/
│   ├── index.ts                # Public API entry point
│   ├── version.ts              # Library version constant
│   ├── constants.ts            # Shared constants
│   ├── network-rule.ts         # Network rule representation (migrated from tsurlfilter)
│   ├── source-map.ts           # Source mapping for converted rules
│   ├── declarative-rule/       # Valibot schemas for DNR rule structures
│   ├── errors/                 # Error types (conversion, options, limitations)
│   ├── filter-converter/       # Top-level converter: scanning, grouping, orchestration
│   ├── re2-regexp/             # RE2 regex validation (WASM and Node extensions)
│   ├── rule-converters/        # Per-rule-type converters (CSP, remove-header, etc.)
│   └── utils/                  # Shared utilities (error handling, string ops)
├── test/                       # Tests (mirrors src/ structure) + mocks + smoke tests
├── tasks/                      # Build scripts (build-txt)
├── dist/                       # Build output (gitignored)
├── rollup.config.ts            # Rollup build config
├── vitest.config.ts            # Vitest config
├── .eslintrc.cjs               # ESLint config
├── tsconfig*.json              # TypeScript configs (base, build, main)
└── package.json
```

## Build And Test Commands

- `pnpm build` — full build: clean dist, bundle via Rollup, emit types, build
  metadata
- `pnpm test` — run unit tests via Vitest
- `pnpm test:light` — run tests excluding benchmarks
- `pnpm test:coverage` — run tests with V8 coverage
- `pnpm test:smoke` — run smoke tests (ESM import + TypeScript exports
  validation)
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

- Since `@adguard/dnr-converter` is a dependency of `@adguard/dnr-rulesets`,
  consider updating its changelog when making breaking or behavioral changes.

## Code Guidelines

### I. Architecture

1. **Two conversion flows.** The library exposes two distinct flows:
   - **Simple flow**: `FilterConverter` → `Ruleset` — for external consumers
     needing only `DeclarativeRule[]` from plain filter text (synchronous,
     in-memory, no source maps).
   - **Advanced flow**: `FilterConverterWithSourceMap` → `RulesetWithSourceMap`
     — for extension internals requiring source maps, `$badfilter` cross-filter
     application via `computeRulesToDisable()`, and full serialization.

   Both flows route through `RulesScanner` → `RulesConverter` → per-type
   converters.

   **Rationale**: Separates the concern of external consumers (simple `DeclarativeRule[]`
   output) from internal extension machinery (source maps, hash maps, lazy loading).

2. **Per-rule-type converters.** Each rule modifier that needs special
   conversion logic (CSP, remove-header, remove-param, `$badfilter`) has its
   own converter in `src/rule-converters/`.

   **Rationale**: Keeps conversion logic modular and testable.

3. **Valibot schemas for DNR structures.** All Chrome DNR rule types
   (`DeclarativeRule`, `RuleAction`, `RuleCondition`, etc.) are defined as
   Valibot schemas in `src/declarative-rule/`.

   **Rationale**: Enables runtime validation and type inference from a single
   source of truth.

### II. Code Quality Standards

1. **JSDoc is required** on all exported classes, properties, methods, and
   functions. Descriptions must be complete sentences.

   **Rationale**: Enforced by `eslint-plugin-jsdoc`.

2. **TypeScript strict mode** is enabled. Code MUST compile cleanly under
   `pnpm lint:types`.

3. **Module boundary enforcement** via `eslint-plugin-boundaries` ensures
   proper layering between converter modules. Respect the layer/element
   configuration in `.eslintrc.cjs`.

### III. Testing Discipline

1. **Smoke tests** validate that published exports resolve correctly (ESM
   imports and TypeScript types). Located in `test/smoke/`.

   **Rationale**: Catches packaging regressions before publishing.

2. **Coverage** is tracked via `@vitest/coverage-v8`. Run
   `pnpm test:coverage` to check. `src/index.ts`, `src/constants.ts`, and
   `src/declarative-rule/` are excluded (re-exports, constants, pure schemas).

3. **`test:prod` is the gate.** Always run `pnpm test:prod` before
   considering a change complete. It combines lint, smoke tests, and the full
   test suite with no cache.
