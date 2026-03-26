# Development

This guide covers the development workflow for `@adguard/css-tokenizer`.

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

### Build the Package

```bash
pnpm --filter @adguard/css-tokenizer build
```

This cleans `dist/`, builds metadata, bundles via Rollup (CJS + ESM + bundled
`.d.ts`), and removes intermediate type artifacts.

### Running Locally

The package is a library with no dev server. Development consists of building,
running tests, and linting.

## Development Workflow

### Code Style

This project uses ESLint (airbnb-typescript base) with `eslint-plugin-jsdoc`
and markdownlint. Run these before committing:

```bash
# Lint code (ESLint)
pnpm --filter @adguard/css-tokenizer lint:code

# Type-check
pnpm --filter @adguard/css-tokenizer lint:types

# Lint markdown files
pnpm --filter @adguard/css-tokenizer lint:md

# All at once
pnpm --filter @adguard/css-tokenizer lint
```

### Running Tests

```bash
# Run unit tests
pnpm --filter @adguard/css-tokenizer test

# Run tests with V8 coverage
pnpm --filter @adguard/css-tokenizer test:coverage

# Run smoke tests (ESM, CJS, TypeScript imports)
pnpm --filter @adguard/css-tokenizer test:smoke
```

All commands can also be run from the `packages/css-tokenizer/` directory
directly (e.g. `pnpm test`).

### Building for Production

```bash
pnpm --filter @adguard/css-tokenizer build
```

Build output goes to `dist/`:

- `dist/csstokenizer.js` — CJS bundle
- `dist/csstokenizer.mjs` — ESM bundle
- `dist/csstokenizer.d.ts` — Bundled type declarations

## Common Tasks

### Modifying the Tokenizer

1. Edit files in `src/` (e.g. `css-tokenizer.ts` for standard CSS,
   `extended-css-tokenizer.ts` for Extended CSS).
2. Algorithmic implementations in `src/algorithms/` mirror the CSS Syntax
   Level 3 specification's "consume" functions.
3. Export new public symbols from `src/index.ts`.
4. Run `pnpm lint` and `pnpm test`.
5. Run `pnpm test:smoke` to verify ESM, CJS, and TypeScript imports.

### Downstream Impact

`@adguard/css-tokenizer` is a dependency of `@adguard/agtree` and
`@adguard/tsurlfilter`. After making breaking or behavioral changes, verify
downstream packages still build and pass tests.

## Troubleshooting

### Issue: Dependencies fail to install

**Solution**: Clean and reinstall from the monorepo root:

```bash
pnpm ri
```

### Issue: Smoke tests fail

**Solution**: Ensure the package is built before running smoke tests:

```bash
pnpm --filter @adguard/css-tokenizer build
pnpm --filter @adguard/css-tokenizer test:smoke
```

## Additional Resources

- [README.md](README.md) — Package overview and API documentation
- [AGENTS.md](AGENTS.md) — AI agent instructions and code guidelines
- [CHANGELOG.md](CHANGELOG.md) — Version history
- [CSS Syntax Level 3 spec](https://www.w3.org/TR/css-syntax-3/) — Reference
  specification
- [Root DEVELOPMENT.md](../../DEVELOPMENT.md) — Monorepo-wide development guide
