# AGENTS.md

## Project Overview

`@adguard/tswebextension` wraps the browser web extension API to integrate
AdGuard's content blocking engine (`@adguard/tsurlfilter`) into browser
extensions. It provides separate implementations for Manifest
V2 and Manifest V3 extensions, handling request blocking, cosmetic rule
injection, scriptlet execution, and filtering log management. It also ships
content scripts and a CLI for build-time tasks.

## Technical Context

- **Language/Version**: TypeScript (ESM-only output), Node.js ≥ 22
- **Primary Dependencies**: `@adguard/tsurlfilter` (blocking engine),
  `@adguard/agtree` (rule parsing), `@adguard/logger` (logging),
  `@adguard/scriptlets`, `@adguard/assistant`, `@adguard/extended-css`,
  `webextension-polyfill`, `zod` (schema validation), `lodash-es`, `lru-cache`,
  `idb` (IndexedDB wrapper), `superjson`, `bowser`, `tldts`
- **Build Toolchain**: Rollup (with `@rollup/plugin-swc`), `rollup-plugin-dts`
  (type bundling), `tsc` + custom `transform-dts.ts`
- **Testing**: Vitest (multi-project config: `mv2`, `mv3`, `common`), with
  `@vitest/coverage-v8`, `fake-indexeddb`, `sinon-chrome`
- **Linting**: ESLint (airbnb-typescript base), `eslint-plugin-jsdoc`,
  `@vitest/eslint-plugin`
- **Output Format**: ESM bundles + content scripts, type declarations
  (`dist/types/`)
- **Target Platform**: Browser extensions (MV2 and MV3)
- **Project Type**: Package inside the `tsurlfilter` pnpm monorepo

## Project Structure

```text
packages/tswebextension/
├── src/
│   ├── cli/                    # CLI entry point (build-time tasks)
│   └── lib/
│       ├── index.ts            # MV2 public API barrel
│       ├── common/             # Shared code (request handling, rules, storage)
│       ├── mv2/                # MV2-specific implementation
│       │   ├── background/     # Background script modules
│       │   ├── common/         # MV2 shared utilities
│       │   └── content-script/ # MV2 content scripts
│       └── mv3/                # MV3-specific implementation
│           ├── background/     # Background script modules
│           ├── content-script/ # MV3 content scripts
│           ├── tabs/           # Tab management
│           ├── utils/          # MV3 utilities
│           └── errors/         # MV3-specific errors
├── test/                       # Tests (mv2/, mv3/, common/) + smoke tests
├── tasks/                      # Build scripts (build-txt, transform-dts, etc.)
├── dist/                       # Build output (gitignored)
├── rollup.config.ts            # Rollup build config
├── vitest.config.ts            # Vitest multi-project config
├── vitest.setup.ts             # Vitest setup (mocks, globals)
├── .eslintrc.cjs               # ESLint config
├── tsconfig*.json              # TypeScript configs (base, build, main)
└── package.json
```

## Build And Test Commands

- `pnpm build` — full build: clean dist, emit types, bundle via Rollup, build
  metadata
- `pnpm test` — run all tests via Vitest (mv2 + mv3 + common projects)
- `pnpm test:mv2` — run MV2 tests only
- `pnpm test:mv3` — run MV3 tests only
- `pnpm test:common` — run common tests only
- `pnpm test:coverage` — run tests with V8 coverage
- `pnpm test:smoke` — run smoke tests (exports validation + Rollup builder)
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

- Since `@adguard/tswebextension` is a dependency of `@adguard/api` and
  `@adguard/api-mv3`, consider updating their changelogs when making breaking
  or behavioral changes.

## Code Guidelines

### I. Architecture

1. **MV2/MV3 split.** The package maintains separate implementations for
   Manifest V2 (`src/lib/mv2/`) and Manifest V3 (`src/lib/mv3/`). Shared
   code lives in `src/lib/common/`. Each has its own export path (`.` for
   MV2, `./mv3` for MV3).

   **Rationale**: MV2 and MV3 have fundamentally different APIs (blocking
   webRequest vs. declarativeNetRequest). Shared logic is factored into
   `common/` to avoid duplication.

2. **Multiple export paths.** The package exposes subpath exports for MV2,
   MV3, content scripts, CLI, assistant inject, CSS hits counter, and filters
   storage. New public API MUST be exported through the appropriate barrel.

   **Rationale**: Consumers import only what they need; content scripts are
   side-effectful and must be separate entry points.

3. **Content scripts are side-effectful.** Files like `content-script.js`,
   `assistant-inject.js`, and `gpc.mv3.js` are marked as `sideEffects` in
   `package.json` and execute on injection.

   **Rationale**: These scripts run in the page context and must not be
   tree-shaken.

4. **CLI is a separate entry point.** The `src/cli/` directory provides
   build-time utilities, shipped as a separate export.

   **Rationale**: Keeps CLI/build-time code out of the runtime library bundle.

### II. Code Quality Standards

1. **JSDoc is required** on all exported classes, methods, and functions.

   **Rationale**: Enforced by `eslint-plugin-jsdoc`.

2. **TypeScript strict mode** is enabled. Code MUST compile cleanly under
   `pnpm lint:types`.

### III. Testing Discipline

1. **Multi-project Vitest config.** Tests are organized into three Vitest
   projects (`mv2`, `mv3`, `common`) in `vitest.config.ts`. Each project
   targets the corresponding source and test directories.

   **Rationale**: Prevents MV2-specific mocks from interfering with MV3 tests
   and vice versa.

2. **Smoke tests** validate that published exports resolve correctly and the
   package can be bundled via Rollup. Located in `test/smoke/` and
   `test/builders/rollup-ts/`.

   **Rationale**: Catches packaging regressions before publishing.

3. **`test:prod` is the gate.** Always run `pnpm test:prod` before
   considering a change complete.
