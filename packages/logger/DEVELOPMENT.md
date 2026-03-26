# Development

This guide covers the development workflow for `@adguard/logger`.

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
pnpm --filter @adguard/logger build
```

This cleans `dist/`, bundles via Rollup (CJS + ESM), emits type declarations,
and builds metadata.

### Running Locally

The package is a library with no dev server. Development consists of building,
running tests, and linting.

## Development Workflow

### Code Style

This project uses ESLint (airbnb-typescript base) with `eslint-plugin-jsdoc`
for documentation enforcement. Run these before committing:

```bash
# Lint code (ESLint)
pnpm --filter @adguard/logger lint:code

# Type-check
pnpm --filter @adguard/logger lint:types

# Both at once
pnpm --filter @adguard/logger lint
```

### Running Tests

```bash
# Run unit tests
pnpm --filter @adguard/logger test

# Run smoke tests (ESM, CJS, TypeScript imports)
pnpm --filter @adguard/logger test:smoke
```

All commands can also be run from the `packages/logger/` directory directly
(e.g. `pnpm test`).

### Building for Production

```bash
pnpm --filter @adguard/logger build
```

Build output goes to `dist/`:

- `dist/index.js` — CJS bundle
- `dist/es/index.mjs` — ESM bundle
- `dist/types/` — TypeScript declarations

## Common Tasks

### Modifying the Logger API

1. Edit `src/Logger.ts` or add new files in `src/`.
2. Export new public symbols from `src/index.ts`.
3. Run `pnpm lint` and `pnpm test`.
4. Run `pnpm test:smoke` to verify ESM, CJS, and TypeScript imports work.

### Downstream Impact

`@adguard/logger` is a dependency of `@adguard/tsurlfilter`,
`@adguard/tswebextension`, and `@adguard/dnr-rulesets`. After making breaking
or behavioral changes, verify downstream packages still build and pass tests.

## Troubleshooting

### Issue: Dependencies fail to install

**Solution**: Clean and reinstall from the monorepo root:

```bash
pnpm ri
```

### Issue: Smoke tests fail

**Solution**: Ensure the package is built before running smoke tests:

```bash
pnpm --filter @adguard/logger build
pnpm --filter @adguard/logger test:smoke
```

## Additional Resources

- [README.md](README.md) — Package overview and API documentation
- [AGENTS.md](AGENTS.md) — AI agent instructions and code guidelines
- [CHANGELOG.md](CHANGELOG.md) — Version history
- [Root DEVELOPMENT.md](../../DEVELOPMENT.md) — Monorepo-wide development guide
