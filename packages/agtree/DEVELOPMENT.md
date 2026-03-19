# Development

This guide covers the development workflow for `@adguard/agtree`.

## Prerequisites

- **Node.js**: v22 or later
- **pnpm**: v10 (managed via the monorepo root)

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

Before working on `agtree`, build the packages it depends on:

```bash
pnpm --filter @adguard/css-tokenizer build
```

Or build everything at once using Lerna:

```bash
npx lerna run build --scope @adguard/agtree --include-dependencies
```

### Build the Package

```bash
pnpm --filter @adguard/agtree build
```

This cleans `dist/`, builds metadata, generates compatibility tables wiki,
bundles via Rollup (ESM), and emits type declarations.

### Running Locally

The package is a library with no dev server. Development consists of building,
running tests, and linting.

## Development Workflow

### Code Style

This project uses ESLint (airbnb-typescript base) with `eslint-plugin-jsdoc`
and markdownlint. Run these before committing:

```bash
# Lint code (ESLint)
pnpm --filter @adguard/agtree lint:code

# Type-check
pnpm --filter @adguard/agtree lint:types

# Lint markdown files
pnpm --filter @adguard/agtree lint:md

# All at once
pnpm --filter @adguard/agtree lint
```

### Running Tests

```bash
# Run unit tests (no cache)
pnpm --filter @adguard/agtree test

# Run tests with V8 coverage
pnpm --filter @adguard/agtree coverage

# Run smoke tests (ESM import + exports validation)
pnpm --filter @adguard/agtree test:smoke
```

All commands can also be run from the `packages/agtree/` directory directly
(e.g. `pnpm test`).

### Building for Production

```bash
pnpm --filter @adguard/agtree build
```

Build output goes to `dist/`:

- `dist/index.js` — ESM main entry
- `dist/parser/index.js` — ESM parser entry
- `dist/generator/index.js` — ESM generator entry
- `dist/converter/index.js` — ESM converter entry
- `dist/utils/index.js` — ESM utils entry
- `dist/types/` — TypeScript declarations

## Common Tasks

### Adding a New Parser or Generator Feature

1. Implement the feature in the appropriate `src/` subdirectory (`parser/`,
   `generator/`, `converter/`, etc.).
2. Export public API through the appropriate barrel file (`src/index.ts`,
   `src/parser/index.ts`, etc.).
3. Add tests in `test/` mirroring the source structure.
4. Run `pnpm lint` and `pnpm test`.
5. Run `pnpm test:smoke` to verify exports.

### Updating Compatibility Tables

Compatibility tables in `src/compatibility-tables/` describe which adblocker
syntaxes support which features. To regenerate wiki pages:

```bash
pnpm --filter @adguard/agtree build-compatibility-tables-wiki
```

### Downstream Impact

`@adguard/agtree` is a dependency of `@adguard/tsurlfilter`,
`@adguard/tswebextension`, and `@adguard/dnr-rulesets`. After making breaking
or behavioral changes, verify downstream packages still build and pass tests.

## Troubleshooting

### Issue: Dependencies fail to install

**Solution**: Clean and reinstall from the monorepo root:

```bash
pnpm ri
```

### Issue: Build fails with workspace dependency errors

**Solution**: Ensure workspace dependencies are built first:

```bash
npx lerna run build --scope @adguard/agtree --include-dependencies
```

### Issue: Smoke tests fail

**Solution**: Ensure the package is built before running smoke tests:

```bash
pnpm --filter @adguard/agtree build
pnpm --filter @adguard/agtree test:smoke
```

## Additional Resources

- [README.md](README.md) — Package overview and API documentation
- [AGENTS.md](AGENTS.md) — AI agent instructions and code guidelines
- [CHANGELOG.md](CHANGELOG.md) — Version history
- [Root DEVELOPMENT.md](../../DEVELOPMENT.md) — Monorepo-wide development guide
