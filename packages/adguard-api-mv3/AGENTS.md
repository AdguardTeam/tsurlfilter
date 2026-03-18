# AGENTS.md

## Project Overview

`@adguard/api-mv3` is a high-level TypeScript library that provides a complete
ad filtering API for Manifest V3 browser extensions. It is the MV3 counterpart
of `@adguard/api`, managing filter configuration and delegating content
blocking to `@adguard/tswebextension`'s MV3 implementation. It handles
Declarative Net Request (DNR) integration and service worker lifecycle.

## Technical Context

- **Language/Version**: TypeScript, Node.js ≥ 22
- **Primary Dependencies**: `@adguard/tswebextension` (content blocking
  engine wrapper), `zod` (schema validation)
- **Build Toolchain**: Rollup (with `@rollup/plugin-swc`), `tsc` for type
  declarations
- **Testing**: Vitest (e2e tests with `jsdom`)
- **Linting**: ESLint (airbnb-typescript base), `eslint-plugin-jsdoc`
- **Output Format**: ESM bundles (`dist/adguard-api.js`,
  `dist/adguard-content.js`, `dist/adguard-assistant.js`), type declarations
  (`dist/types/`)
- **Target Platform**: Browser extensions (Manifest V3 / Chromium)
- **Project Type**: Package inside the `tsurlfilter` pnpm monorepo

## Project Structure

```text
packages/adguard-api-mv3/
├── src/
│   ├── background/              # Background script modules
│   │   ├── index.ts             # Public API barrel
│   │   ├── main.ts              # AdguardApi main class (MV3)
│   │   ├── configuration.ts     # Configuration schema
│   │   └── request-blocking-logger.ts # Request blocking log
│   └── content-script/          # Content script entry points
├── e2e/                         # End-to-end tests
├── tasks/                       # Build scripts (build-txt)
├── constants.ts                 # Shared build constants
├── dist/                        # Build output (gitignored)
├── rollup.config.ts             # Rollup build config
├── vitest.config.ts             # Vitest config
├── vitest.setup.ts              # Vitest setup (jsdom mocks)
├── .eslintrc.js                 # ESLint config
├── tsconfig*.json               # TypeScript configs (base, build, main)
└── package.json
```

## Build And Test Commands

- `pnpm build` — full build: bundle via Rollup, emit types, build metadata
- `pnpm e2e` — run e2e tests via Vitest
- `pnpm lint` — run ESLint and TypeScript type checking
- `pnpm lint:code` — run ESLint only
- `pnpm lint:types` — run TypeScript type checking only

## Contribution Instructions

You MUST follow the following rules for EVERY task that you perform:

- You MUST verify your changes pass `pnpm lint` (ESLint + type checking)
  before completing a task.

- You MUST run `pnpm e2e` to verify your changes do not break existing
  functionality.

- When the task is finished, update `CHANGELOG.md` in the `Unreleased`
  section. Add entries to the appropriate subsection (`Added`, `Changed`, or
  `Fixed`); do not create duplicate subsections.

- Test changes by building the example extension in
  `packages/examples/adguard-api-mv3/` and verifying it works in a browser.

## Code Guidelines

### I. Architecture

1. **Three export paths.** The package exposes three entry points: main API
   (`.`), content script (`./content-script`), and assistant
   (`./assistant`). New public API MUST be exported through the appropriate
   barrel file.

   **Rationale**: Separates background (service worker) and content script
   contexts.

2. **MV3 service worker lifecycle.** The background script runs as a service
   worker in MV3. Code MUST handle the service worker being terminated and
   restarted at any time.

   **Rationale**: MV3 service workers have limited lifetimes; state must be
   persisted or reconstructable.

3. **DNR integration.** Content blocking uses Chrome's Declarative Net Request
   API via `@adguard/tswebextension`'s MV3 implementation.

   **Rationale**: MV3 does not support blocking webRequest; DNR is the only
   option for network-level blocking.

### II. Code Quality Standards

1. **JSDoc is required** on all exported classes, methods, and functions.

   **Rationale**: Enforced by `eslint-plugin-jsdoc`.

2. **TypeScript strict mode** is enabled. Code MUST compile cleanly under
   `pnpm lint:types`.
