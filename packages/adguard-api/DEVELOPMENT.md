# Development

This guide covers the development workflow for `@adguard/api`.

## Prerequisites

- **Node.js**: v22 or later
- **pnpm**: v10 (managed via the monorepo root)
- **Browser**: Chromium-based or Firefox for testing the example extension

## Getting Started

### Clone the Repository

This package lives inside the `tsurlfilter` monorepo:

```bash
git clone https://github.com/AdguardTeam/tsurlfilter.git
cd tsurlfilter
```

### Install Dependencies

From the **monorepo root**:

```bash
pnpm install
```

### Build Workspace Dependencies

Before working on `adguard-api`, build the packages it depends on:

```bash
npx lerna run build --scope @adguard/api --include-dependencies
```

### Build the Package

```bash
pnpm --filter @adguard/api build
```

This bundles via Rollup (ESM), emits type declarations, and builds metadata.

### Running Locally

The package has no dev server or unit test suite. Test changes by building the
example extension:

```bash
npx lerna run build --scope adguard-api-example
```

Then load the built extension from `packages/examples/adguard-api/build/` as
an unpacked extension in the browser.

## Development Workflow

### Code Style

This project uses ESLint (airbnb-typescript base) with `eslint-plugin-jsdoc`.
Run these before committing:

```bash
# Lint code (ESLint)
pnpm --filter @adguard/api lint:code

# Type-check
pnpm --filter @adguard/api lint:types

# Both at once
pnpm --filter @adguard/api lint
```

### Building for Production

```bash
pnpm --filter @adguard/api build
```

Build output goes to `dist/`:

- `dist/adguard-api.js` — Main API bundle (ESM)
- `dist/adguard-content.js` — Content script bundle
- `dist/adguard-assistant.js` — Assistant bundle
- `dist/types/` — TypeScript declarations

## Common Tasks

### Modifying the API

1. Edit files in `src/background/` (main API) or `src/content-script/`
   (content scripts).
2. Export public symbols through the appropriate barrel file
   (`src/background/index.ts`).
3. Run `pnpm lint`.
4. Build and test via the example extension.

### Testing with the Example Extension

1. Build the package and its dependencies:
   `npx lerna run build --scope @adguard/api --include-dependencies`
2. Build the example:
   `npx lerna run build --scope adguard-api-example`
3. Load `packages/examples/adguard-api/build/` as an unpacked extension.
4. Use [test pages](https://testcases.agrd.dev) to validate filtering.

## Troubleshooting

### Issue: Dependencies fail to install

**Solution**: Clean and reinstall from the monorepo root:

```bash
pnpm ri
```

### Issue: Build fails with workspace dependency errors

**Solution**: Ensure workspace dependencies are built first:

```bash
npx lerna run build --scope @adguard/api --include-dependencies
```

## Additional Resources

- [README.md](README.md) — Package overview and API documentation
- [AGENTS.md](AGENTS.md) — AI agent instructions and code guidelines
- [CHANGELOG.md](CHANGELOG.md) — Version history
- [Example extension](../examples/adguard-api) — Sample MV2 extension
- [Root DEVELOPMENT.md](../../DEVELOPMENT.md) — Monorepo-wide development guide
