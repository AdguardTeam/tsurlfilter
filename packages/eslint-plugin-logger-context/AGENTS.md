# AGENTS.md

## Project Overview

`@adguard/eslint-plugin-logger-context` is an ESLint plugin that enforces
AdGuard logger calls to start with a context tag. It provides a single rule
(`require-logger-context`) that checks that every call to `@adguard/logger`
methods includes a context string as the first argument, improving log
traceability across large codebases.

## Technical Context

- **Language/Version**: TypeScript, Node.js ≥ 22
- **Primary Dependencies**: `@typescript-eslint/utils` (ESLint rule utilities)
- **Build Toolchain**: Rollup (with `@rollup/plugin-typescript`),
  `rollup-plugin-node-externals`, `tsc` for type declarations
- **Testing**: None (validated by consuming packages)
- **Linting**: ESLint (airbnb-typescript base)
- **Output Formats**: CJS (`dist/index.js`), ESM (`dist/es/index.mjs`), type
  declarations (`dist/types/`)
- **Target Platform**: Node.js (ESLint plugin)
- **Project Type**: Package inside the `tsurlfilter` pnpm monorepo
- **Internal Dependencies**: `@adguard/logger` (devDependency for type
  reference)

## Project Structure

```text
packages/eslint-plugin-logger-context/
├── src/
│   ├── index.ts                  # Plugin entry point (rule registration)
│   ├── require-logger-context.ts # Rule implementation
│   └── helpers.ts                # Helper functions for AST analysis
├── scripts/                      # Build helper scripts (build-txt)
├── dist/                         # Build output (gitignored)
├── rollup.config.ts              # Rollup build config
├── .eslintrc.js                  # ESLint config
├── tsconfig*.json                # TypeScript configs (base, build, main)
└── package.json
```

## Build And Test Commands

- `pnpm build` — full build: clean dist, bundle via Rollup, emit types, build
  metadata
- `pnpm lint` — run ESLint and TypeScript type checking

## Contribution Instructions

You MUST follow the following rules for EVERY task that you perform:

- You MUST verify your changes pass `pnpm lint` (ESLint + type checking)
  before completing a task.

- The plugin is consumed by `@adguard/tsurlfilter` and
  `@adguard/tswebextension`. After making changes, build the plugin and
  verify it still works in those packages.

## Code Guidelines

### I. Architecture

1. **Single rule plugin.** The package exposes one ESLint rule
   (`require-logger-context`). If additional rules are needed, register them
   in `src/index.ts`.

   **Rationale**: Keeps the plugin focused and simple.

2. **Dual-format output.** The package ships both CJS and ESM bundles to
   support ESLint configs in both formats.

   **Rationale**: ESLint plugins may be loaded in CJS or ESM contexts
   depending on the consumer's configuration.

### II. Code Quality Standards

1. **TypeScript strict mode** is enabled. Code MUST compile cleanly under
   `pnpm lint`.
