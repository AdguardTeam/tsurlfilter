# Development

This guide covers the development workflow, environment setup, and best
practices for contributing to `@adguard/dnr-rulesets`.

## Prerequisites

- **Required Tools**: Node.js 22.x or later
- **Package Manager**: pnpm (managed via the monorepo root)
- **Optional Tools**: `tsx` (installed as a devDependency, used to run task
  scripts)

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

This installs dependencies for all packages, including `dnr-rulesets`.

### Build Workspace Dependencies

Before working on `dnr-rulesets`, build the workspace packages it depends on:

```bash
pnpm --filter @adguard/agtree build
pnpm --filter @adguard/tsurlfilter build
pnpm --filter @adguard/logger build
```

Or build everything at once using Lerna:

```bash
npx lerna run build --scope @adguard/dnr-rulesets --include-dependencies
```

### Running Locally

The package does not have a dev server. Development consists of building assets,
running the CLI, and running tests.

To do a full build (downloads filters, converts to DNR, bundles lib + CLI):

```bash
pnpm --filter @adguard/dnr-rulesets build
```

To run the CLI locally after building:

```bash
node packages/dnr-rulesets/dist/cli.cjs --help
```

To use the watch mode for iterating on filter conversion during extension
development:

```bash
pnpm --filter @adguard/dnr-rulesets build:lib
node packages/dnr-rulesets/dist/cli.cjs watch <path-to-manifest> <path-to-resources>
```

## Development Workflow

### Branch Strategy

- Create feature branches from `main`
- Use descriptive branch names: `feature/add-auth`, `fix/login-bug`
- Open a pull request when ready for review

### Code Style

This project uses ESLint (flat config) with `@stylistic/eslint-plugin` for
formatting and `eslint-plugin-jsdoc` for documentation enforcement. Run these
before committing:

```bash
# Lint code (ESLint)
pnpm --filter @adguard/dnr-rulesets lint:code

# Type-check
pnpm --filter @adguard/dnr-rulesets lint:types

# Both at once
pnpm --filter @adguard/dnr-rulesets lint
```

Key style rules:

- 4-space indentation, single quotes, semicolons
- 120-character max line length
- Sorted imports (via `simple-import-sort`)
- JSDoc required on all public APIs, classes, and functions

### Running Tests

```bash
# Run all unit tests
pnpm --filter @adguard/dnr-rulesets test

# Run tests with V8 coverage (100 % thresholds enforced)
pnpm --filter @adguard/dnr-rulesets test:coverage

# Run smoke tests (ESM import + exports validation via tsd)
pnpm --filter @adguard/dnr-rulesets test:smoke
```

All commands can also be run from the `packages/dnr-rulesets/` directory
directly (e.g. `pnpm test`).

### Building for Production

```bash
# Full build: clear → build assets → build lib + CLI + types
pnpm --filter @adguard/dnr-rulesets build
```

Individual build steps:

```bash
# Download filters and convert to DNR rulesets
pnpm --filter @adguard/dnr-rulesets build:assets

# Bundle library (ESM) + CLI (CJS) + type declarations
pnpm --filter @adguard/dnr-rulesets build:lib

# Regenerate the "Included filter lists" section in README.md
pnpm --filter @adguard/dnr-rulesets build:docs

# Validate built assets
pnpm --filter @adguard/dnr-rulesets validate:assets
```

Build output goes to `dist/`:

- `dist/lib/` — ESM library
- `dist/utils/` — ESM utils
- `dist/types/` — TypeScript declarations
- `dist/cli.cjs` — CLI binary
- `dist/re2.wasm` — WASM binary (copied at build time)
- `dist/filters/` — downloaded filter assets (from `build:assets`)

## Common Tasks

### Adding a New CLI Command

1. Add a new `program.command(...)` block in `src/cli.ts`.
2. Implement the underlying logic in `src/lib/` and export it from
   `src/lib/index.ts`.
3. Add tests in `test/lib/` mirroring the source structure.
4. Update `README.md` with CLI usage documentation.

### Adding a New Library API

1. Create the implementation in `src/lib/` (or `src/utils/` for utilities).
2. Export it from the appropriate barrel file (`src/lib/index.ts` or
   `src/utils/index.ts`).
3. Add tests in `test/lib/` or `test/utils/`.
4. Update `README.md` with API documentation.
5. Verify smoke tests still pass: `pnpm test:smoke`.

### Updating Filter Lists

The list of included filters is auto-generated. To update:

1. Run `pnpm build:assets` to download the latest filters.
2. Run `pnpm build:docs` to regenerate the README section.
3. Do NOT manually edit the "Included filter lists" section in `README.md`.

### Debugging

- The `watch` CLI command supports a `--debug` flag for extended logging during
  DNR conversion.
- The package uses `@adguard/logger` — import and use the logger from
  `src/utils/logger.ts` for adding diagnostic output.

## Troubleshooting

### Issue: Dependencies fail to install

**Solution**: Clean and reinstall from the monorepo root:

```bash
pnpm ri
```

This runs `pnpm clean && pnpm install`, clearing all `node_modules` and
`dist` directories across the monorepo.

### Issue: Build fails with workspace dependency errors

**Solution**: Ensure workspace dependencies are built first:

```bash
npx lerna run build --scope @adguard/dnr-rulesets --include-dependencies
```

### Issue: `re2.wasm` not found at runtime

**Solution**: The Rollup build copies `re2.wasm` to `dist/`. Ensure you ran a
full `pnpm build` (not just `build:lib`). The WASM file path is resolved from
`@adguard/re2-wasm` at build time in `rollup.config.ts`.

### Issue: Tests fail with coverage below thresholds

**Solution**: This package enforces 100 % coverage for branches, functions,
lines, and statements. Add tests for any uncovered code paths. Check coverage
details with:

```bash
pnpm test:coverage
```

## Additional Resources

- [README.md](README.md) — Package overview, CLI usage, and API reference
- [AGENTS.md](AGENTS.md) — AI agent instructions and code guidelines
- [CHANGELOG.md](CHANGELOG.md) — Version history
- [TSUrlFilter declarative-converter](../tsurlfilter/README.md#declarativeconverter) — Underlying DNR conversion engine
- [adguard-api-mv3 example](../examples/adguard-api-mv3) — Usage example
