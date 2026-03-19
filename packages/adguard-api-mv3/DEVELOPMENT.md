# Development

This guide covers the development workflow for `@adguard/api-mv3`.

## Prerequisites

- **Node.js**: v22 or later
- **pnpm**: v10 (managed via the monorepo root)
- **Browser**: Chromium-based (MV3 extensions require Chromium)

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

Before working on `adguard-api-mv3`, build the packages it depends on:

```bash
npx lerna run build --scope @adguard/api-mv3 --include-dependencies
```

### Build the Package

```bash
pnpm --filter @adguard/api-mv3 build
```

This bundles via Rollup (ESM), emits type declarations, and builds metadata.

### Running Locally

Test changes by building the example extension:

```bash
npx lerna run build --scope adguard-api-mv3-example
```

Then load the built extension from
`packages/examples/adguard-api-mv3/build/` as an unpacked extension in Chrome.

## Development Workflow

### Code Style

This project uses ESLint (airbnb-typescript base) with `eslint-plugin-jsdoc`.
Run these before committing:

```bash
# Lint code (ESLint)
pnpm --filter @adguard/api-mv3 lint:code

# Type-check
pnpm --filter @adguard/api-mv3 lint:types

# Both at once
pnpm --filter @adguard/api-mv3 lint
```

### Running Tests

```bash
# Run e2e tests
pnpm --filter @adguard/api-mv3 e2e
```

### Building for Production

```bash
pnpm --filter @adguard/api-mv3 build
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
2. Export public symbols through `src/background/index.ts`.
3. Run `pnpm lint` and `pnpm e2e`.
4. Build and test via the example extension.

### Testing with the Example Extension

1. Build the package and its dependencies:
   `npx lerna run build --scope @adguard/api-mv3 --include-dependencies`
2. Build the example:
   `npx lerna run build --scope adguard-api-mv3-example`
3. Load `packages/examples/adguard-api-mv3/build/` as an unpacked extension
   in Chrome.
4. Use [test pages](https://testcases.agrd.dev) to validate filtering.

### MV3 Service Worker Considerations

The background script runs as a service worker in MV3. Code must handle the
service worker being terminated and restarted at any time. State must be
persisted or reconstructable.

## Troubleshooting

### Issue: Dependencies fail to install

**Solution**: Clean and reinstall from the monorepo root:

```bash
pnpm ri
```

### Issue: Build fails with workspace dependency errors

**Solution**: Ensure workspace dependencies are built first:

```bash
npx lerna run build --scope @adguard/api-mv3 --include-dependencies
```

## Additional Resources

- [README.md](README.md) — Package overview and API documentation
- [AGENTS.md](AGENTS.md) — AI agent instructions and code guidelines
- [CHANGELOG.md](CHANGELOG.md) — Version history
- [Example extension](../examples/adguard-api-mv3) — Sample MV3 extension
- [Root DEVELOPMENT.md](../../DEVELOPMENT.md) — Monorepo-wide development guide
