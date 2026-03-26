# AGENTS.md

## Project Overview

The `packages/examples/` directory contains sample browser extensions that
demonstrate how to integrate AdGuard's content blocking libraries into real
extensions. Each example is a standalone workspace package that can be built
and loaded into a browser for testing.

## Technical Context

- **Language/Version**: TypeScript, Node.js ≥ 22
- **Build Toolchain**: Webpack (via custom `tsx` build scripts)
- **Target Platform**: Browser extensions (Chromium, Firefox)
- **Project Type**: Example packages inside the `tsurlfilter` pnpm monorepo
- **Not published**: These packages are private and not published to npm

## Project Structure

```text
packages/examples/
├── adguard-api/             # MV2 extension using @adguard/api
│   ├── extension/           # Extension source (manifest, background, popup)
│   └── scripts/             # Build scripts
├── adguard-api-mv3/         # MV3 extension using @adguard/api-mv3
│   ├── extension/           # Extension source (manifest, background, popup)
│   └── scripts/             # Build scripts
├── tswebextension-mv2/      # MV2 extension using @adguard/tswebextension directly
│   ├── extension/           # Extension source (manifest, background, popup, options)
│   └── scripts/             # Build + browser test scripts
└── tswebextension-mv3/      # MV3 extension using @adguard/tswebextension directly
    ├── extension/           # Extension source (manifest, background, popup, options)
    └── scripts/             # Build + browser test scripts
```

## Build And Test Commands

Each example is built from its own directory or via Lerna from the root:

- **adguard-api example**: `npx lerna run build --scope adguard-api-example`
- **adguard-api-mv3 example**: `npx lerna run build --scope adguard-api-mv3-example`
- **tswebextension MV2**: `npx lerna run build --scope tswebextension-mv2`
- **tswebextension MV3**: `npx lerna run build --scope tswebextension-mv3`

Or from each example directory:

- `pnpm build` — build the extension
- `pnpm lint` — run ESLint (and type checking where configured)
- `pnpm test` — run browser tests (tswebextension examples only)

Built extensions are output to `build/` and can be loaded as unpacked
extensions in the browser.

## Contribution Instructions

- These are development/testing aids, not published packages. Keep them
  functional but minimal.

- When making changes to core packages (`tswebextension`, `adguard-api`,
  `adguard-api-mv3`), verify the relevant example still builds and loads
  correctly.

- Use [test pages](https://testcases.agrd.dev) to validate filtering.
