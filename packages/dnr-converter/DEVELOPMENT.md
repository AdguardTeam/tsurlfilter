# Development

This guide covers the development workflow for `@adguard/dnr-converter`.

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

Before working on `dnr-converter`, build the packages it depends on:

```bash
pnpm --filter @adguard/agtree build
pnpm --filter @adguard/logger build
```

Or build everything at once using Lerna:

```bash
npx lerna run build --scope @adguard/dnr-converter --include-dependencies
```

### Build the Package

```bash
pnpm --filter @adguard/dnr-converter build
```

This cleans `dist/`, bundles via Rollup (ESM), emits type declarations to
`dist/types/`, and writes build metadata to `dist/build.txt`.

### Running Locally

The package is a library with no dev server. Development consists of building,
running tests, and linting.

For iterative development, use watch mode:

```bash
pnpm --filter @adguard/dnr-converter start
```

## Development Workflow

### Code Style

Run these before committing:

```bash
# Lint code (ESLint)
pnpm --filter @adguard/dnr-converter lint:code

# Type-check
pnpm --filter @adguard/dnr-converter lint:types

# Both at once
pnpm --filter @adguard/dnr-converter lint
```

### Running Tests

```bash
# Run unit tests
pnpm --filter @adguard/dnr-converter test

# Run tests excluding benchmarks
pnpm --filter @adguard/dnr-converter test:light

# Run tests with V8 coverage
pnpm --filter @adguard/dnr-converter test:coverage

# Run smoke tests (ESM import + exports validation)
pnpm --filter @adguard/dnr-converter test:smoke

# Full validation (lint + smoke + full test suite, no cache)
pnpm --filter @adguard/dnr-converter test:prod
```

**Always run `pnpm test:prod` before submitting changes.** It requires the
package to be built first (`pnpm build`).

All commands can also be run from the `packages/dnr-converter/` directory
directly (e.g. `pnpm test`).

### Building for Production

```bash
pnpm --filter @adguard/dnr-converter build
```

Build output goes to `dist/`:

- `dist/index.js` — ESM main entry
- `dist/types/` — TypeScript declarations

## Common Tasks

### Adding a New Rule Converter

1. Implement the converter in `src/rule-converters/`.
2. Export it through `src/index.ts` if it is part of the public API.
3. Add tests in `test/src/rule-converters/`.
4. Run `pnpm build && pnpm test:prod`.

### Updating Declarative Rule Schemas

DNR rule type definitions and valibot schemas live in `src/declarative-rule/`.
After changing schemas:

1. Update the corresponding types and validators.
2. Run `pnpm build && pnpm test:prod` to verify nothing regressed.

### Downstream Impact

`@adguard/dnr-converter` may be consumed by other packages or tools. After
making breaking or behavioral changes, verify that any consumers still build
and pass tests.

## Troubleshooting

### Issue: `Cannot find module '@adguard/agtree'` (or `@adguard/logger`)

**Solution**: Workspace dependencies need to be built first:

```bash
npx lerna run build --scope @adguard/dnr-converter --include-dependencies
```

### Issue: Tests fail with stale build artifacts

**Solution**: Clean and rebuild:

```bash
pnpm --filter @adguard/dnr-converter build
pnpm --filter @adguard/dnr-converter test
```

### Issue: Smoke tests fail

**Solution**: Smoke tests require a full build. Run:

```bash
pnpm --filter @adguard/dnr-converter build
pnpm --filter @adguard/dnr-converter test:smoke
```

### Issue: Dependencies fail to install

**Solution**: Clean and reinstall from the monorepo root:

```bash
pnpm ri
```

### Issue: Type errors after pulling new changes

**Solution**: Rebuild dependencies, then run the type checker:

```bash
npx lerna run build --scope @adguard/dnr-converter --include-dependencies
pnpm --filter @adguard/dnr-converter lint:types
```

## Additional Resources

- [README.md](README.md) — package overview and public API documentation
- [CHANGELOG.md](CHANGELOG.md) — release history
- [AGENTS.md](../../AGENTS.md) — monorepo-wide code guidelines and contribution rules
- [Root DEVELOPMENT.md](../../DEVELOPMENT.md) — monorepo-wide development guide
