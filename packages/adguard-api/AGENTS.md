# AGENTS.md

## Project Overview

`@adguard/api` is a high-level TypeScript library that provides a complete ad
filtering API for Manifest V2 browser extensions. It manages filter list
downloading, storage, and updates, and delegates content blocking to
`@adguard/tswebextension`. It is designed to be the primary integration point
for extensions that want AdGuard filtering without directly managing the
engine.

## Technical Context

- **Language/Version**: TypeScript, Node.js ≥ 22
- **Primary Dependencies**: `@adguard/tswebextension` (content blocking
  engine wrapper), `@adguard/assistant` (user assistant UI),
  `@adguard/filters-downloader` (filter list downloading),
  `webextension-polyfill`, `zod` (schema validation)
- **Build Toolchain**: Rollup (with `@rollup/plugin-swc`), `tsc` for type
  declarations
- **Testing**: No unit test suite (integration tested via example extension)
- **Linting**: ESLint (airbnb-typescript base), `eslint-plugin-jsdoc`
- **Output Format**: ESM bundles (`dist/adguard-api.js`,
  `dist/adguard-content.js`, `dist/adguard-assistant.js`), type declarations
  (`dist/types/`)
- **Target Platform**: Browser extensions (Manifest V2)
- **Project Type**: Package inside the `tsurlfilter` pnpm monorepo

## Project Structure

```text
packages/adguard-api/
├── src/
│   ├── background/            # Background script modules
│   │   ├── index.ts           # Public API barrel
│   │   ├── main.ts            # AdguardApi main class
│   │   ├── constants.ts       # Constants
│   │   ├── logger.ts          # Logger setup
│   │   ├── network.ts         # Network utilities
│   │   ├── notifier.ts        # Event notification
│   │   ├── request-blocking-logger.ts # Request blocking log
│   │   ├── storage.ts         # Storage abstraction
│   │   ├── filters/           # Filter list management
│   │   ├── schemas/           # Zod validation schemas
│   │   └── utils/             # Utility functions
│   ├── content-script/        # Content script entry points
│   └── local_script_rules.json # Bundled local script rules
├── tasks/                     # Build scripts (build-txt)
├── constants.ts               # Shared build constants
├── dist/                      # Build output (gitignored)
├── rollup.config.ts           # Rollup build config
├── .eslintrc.js               # ESLint config
├── tsconfig*.json             # TypeScript configs (base, build, main)
└── package.json
```

## Build And Test Commands

- `pnpm build` — full build: bundle via Rollup, emit types, build metadata
- `pnpm lint` — run ESLint and TypeScript type checking
- `pnpm lint:code` — run ESLint only
- `pnpm lint:types` — run TypeScript type checking only

## Contribution Instructions

You MUST follow the following rules for EVERY task that you perform:

- You MUST verify your changes pass `pnpm lint` (ESLint + type checking)
  before completing a task.

- When the task is finished, update `CHANGELOG.md` in the `Unreleased`
  section. Add entries to the appropriate subsection (`Added`, `Changed`, or
  `Fixed`); do not create duplicate subsections.

- Test changes by building the example extension in
  `packages/examples/adguard-api/` and verifying it works in a browser.

## Code Guidelines

### I. Architecture

1. **Three export paths.** The package exposes three entry points: main API
   (`.`), content script (`./content-script`), and assistant
   (`./assistant`). New public API MUST be exported through the appropriate
   barrel file.

   **Rationale**: Separates background and content script contexts, which run
   in different browser environments.

2. **Filter management is the core responsibility.** The `src/background/`
   module handles filter list downloading, caching, updating, and
   configuration. Actual content blocking is delegated to
   `@adguard/tswebextension`.

   **Rationale**: This package serves as the integration layer; the blocking
   engine is a separate concern.

### II. Code Quality Standards

1. **JSDoc is required** on all exported classes, methods, and functions.

   **Rationale**: Enforced by `eslint-plugin-jsdoc`.

2. **TypeScript strict mode** is enabled. Code MUST compile cleanly under
   `pnpm lint:types`.
