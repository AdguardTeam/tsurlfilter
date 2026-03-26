# Development

This guide covers the development workflow for `@adguard/tsurlfilter`.

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

Before working on `tsurlfilter`, build the packages it depends on:

```bash
pnpm --filter @adguard/css-tokenizer build
pnpm --filter @adguard/agtree build
pnpm --filter @adguard/logger build
```

Or build everything at once using Lerna:

```bash
npx lerna run build --scope @adguard/tsurlfilter --include-dependencies
```

### Build the Package

```bash
pnpm --filter @adguard/tsurlfilter build
```

This cleans `dist/`, emits type declarations, bundles via Rollup (ESM + UMD +
IIFE), and builds metadata.

### Running Locally

The package is a library and CLI with no dev server. Use watch mode for
iterative development:

```bash
pnpm --filter @adguard/tsurlfilter start
```

## Development Workflow

### Code Style

This project uses ESLint (airbnb-typescript base) with `eslint-plugin-jsdoc`
and `eslint-plugin-boundaries` for module layering. Run these before
committing:

```bash
# Lint code (ESLint)
pnpm --filter @adguard/tsurlfilter lint:code

# Type-check
pnpm --filter @adguard/tsurlfilter lint:types

# Both at once
pnpm --filter @adguard/tsurlfilter lint
```

### Running Tests

```bash
# Run unit tests
pnpm --filter @adguard/tsurlfilter test

# Run tests excluding benchmarks
pnpm --filter @adguard/tsurlfilter test:light

# Run tests with V8 coverage
pnpm --filter @adguard/tsurlfilter test:coverage

# Run smoke tests (Rollup builder integration)
pnpm --filter @adguard/tsurlfilter test:smoke

# Full validation (lint + smoke + full test suite, no cache)
pnpm --filter @adguard/tsurlfilter test:prod
```

**Always run `pnpm test:prod` before submitting changes.** It requires the
package to be built first (`pnpm build`).

All commands can also be run from the `packages/tsurlfilter/` directory
directly (e.g. `pnpm test`).

### Building for Production

```bash
pnpm --filter @adguard/tsurlfilter build
```

Build output goes to `dist/`:

- `dist/es/` — ESM bundles (main + subpath entries)
- `dist/tsurlfilter.umd.js` — UMD bundle
- `dist/tsurlfilter.iife.js` — IIFE bundle
- `dist/cli.js` — CLI binary
- `dist/types/` — TypeScript declarations

## Common Tasks

### Using the CLI

After building, run the CLI:

```bash
node packages/tsurlfilter/dist/cli.js --help
```

Or via the `bin` entry:

```bash
npx tsurlfilter --help
```

### Adding a New Rule Modifier

1. Implement the modifier in `src/modifiers/`.
2. Register it in the engine's matching logic.
3. Add tests in `test/` mirroring the source structure.
4. Run `pnpm build && pnpm test:prod`.

### Modifying the Declarative Converter

The declarative converter in `src/rules/` translates filter rules to Chrome's
DNR format. It is consumed by `@adguard/dnr-rulesets`.

1. Make changes in `src/rules/declarative-converter/`.
2. Export new API through `src/rules/declarative-converter/index.ts`.
3. Add tests and run `pnpm build && pnpm test:prod`.
4. Verify `@adguard/dnr-rulesets` still works.

### Downstream Impact

`@adguard/tsurlfilter` is a dependency of `@adguard/tswebextension`,
`@adguard/dnr-rulesets`, `@adguard/api`, and `@adguard/api-mv3`. After making
breaking or behavioral changes, verify downstream packages still build and
pass tests.

### Generating API Documentation

```bash
pnpm --filter @adguard/tsurlfilter docs
```

Output goes to `docs/`.

## Troubleshooting

### Issue: Dependencies fail to install

**Solution**: Clean and reinstall from the monorepo root:

```bash
pnpm ri
```

### Issue: Build fails with workspace dependency errors

**Solution**: Ensure workspace dependencies are built first:

```bash
npx lerna run build --scope @adguard/tsurlfilter --include-dependencies
```

### Issue: Smoke tests fail

**Solution**: Smoke tests require a full build. Run:

```bash
pnpm --filter @adguard/tsurlfilter build
pnpm --filter @adguard/tsurlfilter test:smoke
```

### Issue: `test:prod` fails

**Solution**: `test:prod` combines lint, smoke tests, and the full test suite.
Ensure the package is built first:

```bash
pnpm --filter @adguard/tsurlfilter build
pnpm --filter @adguard/tsurlfilter test:prod
```

## Additional Resources

- [README.md](README.md) — Package overview and API documentation
- [AGENTS.md](AGENTS.md) — AI agent instructions and code guidelines
- [CHANGELOG.md](CHANGELOG.md) — Version history
- [Root DEVELOPMENT.md](../../DEVELOPMENT.md) — Monorepo-wide development guide
