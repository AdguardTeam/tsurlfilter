# AGENTS.md

## Project Overview

`@adguard/logger` is a lightweight logging library used across AdGuard browser
extensions and related packages. It provides configurable log levels and
formatted timestamped output for debugging and runtime diagnostics.

## Technical Context

- **Language/Version**: TypeScript, Node.js ≥ 22
- **Build Toolchain**: Rollup (with `@rollup/plugin-typescript`), separate type
  declaration build via `tsc`
- **Testing**: Vitest
- **Linting**: ESLint (airbnb-typescript base), `eslint-plugin-jsdoc`
- **Output Formats**: CJS (`dist/index.js`), ESM (`dist/es/index.mjs`), type
  declarations (`dist/types/`)
- **Target Platform**: Node.js and browser environments
- **Project Type**: Package inside the `tsurlfilter` pnpm monorepo
- **Internal Dependencies**: None (independent leaf package)

## Project Structure

```text
packages/logger/
├── src/
│   ├── index.ts           # Public API barrel
│   ├── Logger.ts          # Logger class implementation
│   ├── error.ts           # Error utilities
│   └── format-time.ts     # Timestamp formatting
├── tests/                 # Unit tests + smoke tests (esm, cjs, typescript)
├── scripts/               # Build helper scripts (build-txt)
├── dist/                  # Build output (gitignored)
├── rollup.config.ts       # Rollup build config
├── vitest.config.ts       # Vitest config
├── .eslintrc.js           # ESLint config
├── tsconfig*.json         # TypeScript configs (base, build, main)
└── package.json
```

## Build And Test Commands

- `pnpm build` — full build: clean dist, bundle via Rollup, emit types, build
  metadata
- `pnpm test` — run unit tests via Vitest
- `pnpm test:smoke` — run smoke tests (ESM, CJS, TypeScript imports)
- `pnpm lint` — run ESLint and TypeScript type checking
- `pnpm lint:code` — run ESLint only
- `pnpm lint:types` — run TypeScript type checking only

## Contribution Instructions

You MUST follow the following rules for EVERY task that you perform:

- You MUST verify your changes pass `pnpm lint` (ESLint + type checking)
  before completing a task.

- You MUST run `pnpm test` to verify your changes do not break existing
  functionality.

- When the task is finished, update `CHANGELOG.md` in the `Unreleased`
  section. Add entries to the appropriate subsection (`Added`, `Changed`, or
  `Fixed`); do not create duplicate subsections.

- Since `@adguard/logger` is a dependency of `@adguard/tsurlfilter`,
  `@adguard/tswebextension`, and `@adguard/dnr-rulesets`, consider updating
  their changelogs when making breaking or behavioral changes.

## Code Guidelines

### I. Architecture

1. **Single entry point.** The package exposes one public API through
   `src/index.ts`. All public symbols MUST be re-exported from this barrel.

   **Rationale**: Keeps the public surface explicit for consumers.

2. **Dual-format output.** The package ships both CJS and ESM bundles to
   support all consumer environments.

   **Rationale**: Some consumers (legacy tooling, tests) require CJS; modern
   bundlers and ESM-only packages require ESM.

### II. Code Quality Standards

1. **JSDoc is required** on all exported classes, methods, and functions.

   **Rationale**: Enforced by `eslint-plugin-jsdoc`.

2. **TypeScript strict mode** is enabled. Code MUST compile cleanly under
   `pnpm lint:types`.

### III. Testing Discipline

1. **Smoke tests** validate that the published package can be imported as ESM,
   CJS, and via TypeScript. Located in `tests/smoke/`.

   **Rationale**: Catches packaging regressions before publishing.
