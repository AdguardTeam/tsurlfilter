# AGENTS.md

## Project Overview

`@adguard/dnr-rulesets` is a build-time utility and CLI tool that creates,
loads, and manages prebuilt AdGuard Declarative Net Request (DNR) rulesets for
Chromium MV3 browser extensions. It downloads AdGuard filter lists, converts
them to DNR JSON rulesets via `@adguard/tsurlfilter`'s declarative converter,
patches extension `manifest.json` with ruleset declarations, and provides a
watch mode for local development. It also exposes a programmatic API for
integration into custom build scripts.

## Technical Context

- **Language/Version**: TypeScript (ESNext target, strict mode)
- **Primary Dependencies**: `@adguard/tsurlfilter` (declarative converter),
  `@adguard/agtree` (filter rule parser), `@adguard/logger`, `commander`
  (CLI), `axios` (HTTP), `zod` (schema validation), `chokidar` (file
  watching), `fs-extra`, `fast-glob`
- **Build Toolchain**: Rollup (with `@rollup/plugin-swc`), `rollup-plugin-dts`
  (type bundling), `tsx` (task scripts)
- **Storage**: None (filesystem only — reads/writes JSON rulesets and
  manifests)
- **Testing**: Vitest (with 100 % coverage thresholds configured for
  `test:coverage` runs)
- **Target Platform**: Node.js ≥ 22 (CLI tool and build-time library; ESM
  output for lib, CJS output for CLI binary)
- **Project Type**: Package inside the `tsurlfilter` pnpm monorepo
- **Constraints**: CLI binary is CJS because `@adguard/re2-wasm` uses raw
  `__dirname`; the WASM file must be copied to `dist/` at build time

## Project Structure

```text
packages/dnr-rulesets/
├── src/
│   ├── cli.ts               # CLI entry point (commander program)
│   ├── common/              # Shared helpers (local script rules, constants)
│   ├── lib/                 # Public library API
│   │   ├── assets/          # AssetsLoader — downloads/copies rulesets
│   │   ├── manifest/        # ManifestPatcher, RulesetsInjector, Watcher
│   │   └── unsafe-rules/    # Unsafe rules exclusion for CWS compliance
│   └── utils/               # Utility entry point (getVersion, etc.)
├── common/                  # Build-time constants and helpers (not published)
├── tasks/                   # Build/CI scripts (run via tsx)
├── test/                    # Tests mirroring src/ structure + smoke tests
├── dist/                    # Build output (gitignored)
├── rollup.config.ts         # Rollup build config (lib + CLI + types)
├── vitest.config.ts         # Vitest config
├── eslint.config.mjs        # ESLint flat config
├── tsconfig*.json           # TypeScript configs (base, build, types)
└── package.json
```

## Build And Test Commands

- `pnpm build` — full build: clear dist, build assets, build lib + CLI
- `pnpm build:assets` — download filters and convert to DNR rulesets
- `pnpm build:lib` — bundle library and CLI via Rollup
- `pnpm build:docs` — regenerate the "Included filter lists" section in README
- `pnpm validate:assets` — validate built assets
- `pnpm test` — run unit tests via Vitest
- `pnpm test:smoke` — run smoke tests (ESM import + exports validation)
- `pnpm test:coverage` — run tests with V8 coverage
- `pnpm lint` — run both code linting and type checking
- `pnpm lint:code` — run ESLint (`eslint --cache .`)
- `pnpm lint:types` — run TypeScript type checking (`tsc`)
- `pnpm clear` — remove `dist/` and `rollup.cache/`

## Contribution Instructions

You MUST follow the following rules for EVERY task that you perform:

- You MUST verify your changes pass all static analysis checks before completing
  a task:
  - `pnpm lint:types` to check for TypeScript errors
  - `pnpm lint:code` to run ESLint

- You MUST update or add unit tests for any changed code.

- You MUST run the test suite to verify your changes do not break existing
  functionality: `pnpm test`.

- When making changes to the project structure, ensure the Project Structure
  section in `AGENTS.md` is updated and remains valid.

- When the task is finished update `CHANGELOG.md` file and explain changes in
  the `Unreleased` section. Add entries to the appropriate subsection (`Added`,
  `Changed`, or `Fixed`) if it already exists; do not create duplicate
  subsections.

- If the prompt essentially asks you to refactor or improve existing code, check
  if you can phrase it as a code guideline. If it's possible, add it to
  the relevant Code Guidelines section in `AGENTS.md`.

- After completing the task you MUST verify that the code you've written
  follows the Code Guidelines in this file.

- You MUST NOT modify auto-generated sections (e.g. "Included filter lists" in
  `README.md`). Use `pnpm build:docs` to regenerate them instead.

## Code Guidelines

### I. Architecture

1. **Three entry points.** The package exposes three separate entry points
   bundled by Rollup:
   - `lib` (`src/lib/index.ts`) — public programmatic API (`AssetsLoader`,
     `ManifestPatcher`, `RulesetsInjector`, `excludeUnsafeRules`).
   - `utils` (`src/utils/index.ts`) — lightweight utility functions
     (`getVersion`, `getVersionTimestampMs`).
   - CLI (`src/cli.ts`) — `commander`-based CLI binary shipped as CJS.

   New public API MUST be exported through the appropriate barrel file. New CLI
   commands MUST be added in `src/cli.ts`.

   **Rationale**: Keeps the public surface explicit and allows tree-shaking for
   consumers who only need a subset.

2. **Shared code lives in `src/common/`.** Code used by both `lib` and `tasks`
   (or by multiple modules within `lib`) SHOULD be placed in `src/common/`.
   Build-time-only constants and helpers live in the top-level `common/`
   directory (outside `src/`).

   **Rationale**: Prevents circular dependencies and clarifies which code ships
   in the published package vs. what is build-only.

3. **Tasks are standalone scripts.** Files under `tasks/` are executed via `tsx`
   and MUST NOT be imported by `src/` code. They may import from the top-level
   `common/` directory.

   **Rationale**: Keeps the published library free of build-time dependencies.

### II. Code Quality Standards

1. **JSDoc is required** on every class, class property, function declaration,
   and method definition. Descriptions MUST be complete sentences. Use `@param`,
   `@returns`, and `@throws` tags as appropriate.

   **Rationale**: Enforced by `eslint-plugin-jsdoc` rules in
   `eslint.config.mjs`.

2. **Max line length is 120 characters.** URLs are exempt.

   **Rationale**: Configured in the ESLint `max-len` rule.

3. **Imports MUST be sorted** using `simple-import-sort`. Group Node built-ins
   first, then external packages, then internal paths.

   **Rationale**: Enforced by `simple-import-sort/imports` ESLint rule.

4. **Use 4-space indentation**, single quotes, semicolons, and `1tbs` brace
   style with arrow parens always present.

   **Rationale**: Enforced by `@stylistic/eslint-plugin` configuration.

5. **Strict TypeScript options are enabled**: `noUnusedLocals`,
   `noUnusedParameters`, `noImplicitReturns`, `noFallthroughCasesInSwitch`.
   All code MUST compile cleanly under `pnpm lint:types`.

   **Rationale**: Prevents common bugs at compile time.

### III. Testing Discipline

1. **Test files mirror `src/` structure** under `test/`. For example, tests for
   `src/lib/manifest/patcher.ts` live in `test/lib/manifest/`.

   **Rationale**: Makes it easy to locate tests for any source file.

2. **100 % coverage thresholds** are configured in `vitest.config.ts` for
   branches, functions, lines, and statements. They are checked when running
   `pnpm test:coverage`. New code SHOULD be covered by tests.

   **Rationale**: Catches regressions in test coverage before publishing.

3. **Smoke tests** validate that the published package can be imported as ESM
   and that all declared exports resolve correctly (via `tsd`). Located in
   `test/smoke/`.

   **Rationale**: Catches packaging regressions before publishing.

### IV. Other

1. **CLI output is CJS.** The CLI binary (`dist/cli.cjs`) is built as
   CommonJS because `@adguard/re2-wasm` relies on `__dirname`. The library
   output is ESM. Do NOT change the CLI format without verifying WASM loading
   still works.

   **Rationale**: Documented in `rollup.config.ts` comments.

2. **All AdGuard workspace packages are bundled into the CLI.** The Rollup CLI
   config excludes most externals but bundles `@adguard/agtree`,
   `@adguard/logger`, and `@adguard/tsurlfilter` because they are ESM-only and
   the CLI output is CJS.

   **Rationale**: Avoids `import.meta.url` issues in CJS context.
