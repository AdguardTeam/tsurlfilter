# Development

This guide covers the development workflow for `@adguard/tswebextension`.

## Prerequisites

- **Node.js**: v22 or later
- **pnpm**: v10 (managed via the monorepo root)
- **Browser**: Chromium-based or Firefox for testing extensions

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

### Building

There are two ways to build:

**1. Via Lerna (from the monorepo root)** — builds the package and all its
workspace dependencies automatically:

```bash
npx lerna run build --scope @adguard/tswebextension --include-dependencies
```

**2. From this directory** — builds only this package (dependencies must already
be built):

```bash
pnpm build
```

The build cleans `dist/`, emits type declarations, bundles via Rollup (ESM
bundles + content scripts), and builds metadata.

### Running Locally

Use watch mode for iterative development:

```bash
pnpm start
```

To test changes in a browser, build one of the example extensions in
`packages/examples/` and load it as an unpacked extension.

## Development Workflow

### Code Style

This project uses ESLint (airbnb-typescript base) with `eslint-plugin-jsdoc`
and `@vitest/eslint-plugin`. Run these before committing:

```bash
# Lint code (ESLint)
pnpm lint:code

# Type-check
pnpm lint:types

# Both at once
pnpm lint
```

### Running Tests

```bash
# Run all tests (mv2 + mv3 + common)
pnpm test

# Run MV2 tests only
pnpm test:mv2

# Run MV3 tests only
pnpm test:mv3

# Run common tests only
pnpm test:common

# Run tests with V8 coverage
pnpm test:coverage

# Run smoke tests (exports validation + Rollup builder)
pnpm test:smoke

# Full validation (lint + smoke + full test suite, no cache)
pnpm test:prod
```

**Always run `pnpm test:prod` before submitting changes.** It requires the
package to be built first (`pnpm build`).

### Build Output

Build output goes to `dist/`:

- `dist/index.js` — MV2 background ESM bundle
- `dist/index.mv3.js` — MV3 background ESM bundle
- `dist/content-script.js` — MV2 content script
- `dist/content-script.mv3.js` — MV3 content script
- `dist/assistant-inject.js` — Assistant injection script
- `dist/gpc.mv3.js` — Global Privacy Control script (MV3)
- `dist/hide-document-referrer.mv3.js` — Document referrer hiding (MV3)
- `dist/cli.js` — CLI binary
- `dist/types/` — TypeScript declarations

## Common Tasks

### Using the CLI

After building, run the CLI:

```bash
npx tswebextension --help
```

### Updating the Companies Database

```bash
pnpm update:companiesdb
```

### Testing with Example Extensions

1. Build the package: `pnpm build`
2. Build an example extension:
   - MV2: `npx lerna run build --scope tswebextension-mv2`
   - MV3: `npx lerna run build --scope tswebextension-mv3`
3. Load the built extension from `packages/examples/<name>/build/` as an
   unpacked extension in the browser.
4. Use [test pages](https://testcases.agrd.dev) to validate filtering.

### Downstream Impact

`@adguard/tswebextension` is a dependency of `@adguard/api` and
`@adguard/api-mv3`. After making breaking or behavioral changes, verify
downstream packages still build and pass tests.

## Troubleshooting

### Issue: Dependencies fail to install

**Solution**: Clean and reinstall from the monorepo root:

```bash
pnpm ri
```

### Issue: Build fails with workspace dependency errors

**Solution**: Ensure workspace dependencies are built first:

```bash
npx lerna run build --scope @adguard/tswebextension --include-dependencies
```

### Issue: `test:prod` fails

**Solution**: `test:prod` combines lint, smoke tests, and the full test suite.
Ensure the package is built first:

```bash
pnpm build
pnpm test:prod
```

### Issue: MV2 vs MV3 test isolation

Tests are organized into three Vitest projects (`mv2`, `mv3`, `common`). If
MV2-specific mocks interfere with MV3 tests (or vice versa), ensure you are
running the correct test project.

## Additional Resources

- [README.md](README.md) — Package overview and API documentation
- [AGENTS.md](AGENTS.md) — AI agent instructions and code guidelines
- [CHANGELOG.md](CHANGELOG.md) — Version history
- [Root DEVELOPMENT.md](../../DEVELOPMENT.md) — Monorepo-wide development guide
