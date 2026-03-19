# Development

This guide covers the development workflow for
`@adguard/eslint-plugin-logger-context`.

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

The plugin has a dev dependency on `@adguard/logger` (for type reference).
Build it first:

```bash
pnpm --filter @adguard/logger build
```

### Build the Package

```bash
pnpm --filter @adguard/eslint-plugin-logger-context build
```

This cleans `dist/`, bundles via Rollup (CJS + ESM), emits type declarations,
and builds metadata.

### Running Locally

The package is an ESLint plugin with no dev server or test suite. Validate
changes by building the plugin and verifying it works in consuming packages
(`@adguard/tsurlfilter`, `@adguard/tswebextension`).

## Development Workflow

### Code Style

This project uses ESLint (airbnb-typescript base). Run before committing:

```bash
pnpm --filter @adguard/eslint-plugin-logger-context lint
```

This runs both ESLint and TypeScript type checking.

### Building for Production

```bash
pnpm --filter @adguard/eslint-plugin-logger-context build
```

Build output goes to `dist/`:

- `dist/index.js` — CJS bundle
- `dist/es/index.mjs` — ESM bundle
- `dist/types/` — TypeScript declarations

## Common Tasks

### Adding a New ESLint Rule

1. Create the rule implementation in `src/` (e.g. `src/my-rule.ts`).
2. Register it in `src/index.ts`.
3. Run `pnpm lint`.
4. Build the plugin and test it in a consuming package.

### Verifying in Consuming Packages

After making changes:

1. Build the plugin: `pnpm --filter @adguard/eslint-plugin-logger-context build`
2. Run lint in a consuming package:
   - `pnpm --filter @adguard/tsurlfilter lint:code`
   - `pnpm --filter @adguard/tswebextension lint:code`

## Troubleshooting

### Issue: Dependencies fail to install

**Solution**: Clean and reinstall from the monorepo root:

```bash
pnpm ri
```

## Additional Resources

- [README.md](README.md) — Package overview and usage
- [AGENTS.md](AGENTS.md) — AI agent instructions and code guidelines
- [CHANGELOG.md](CHANGELOG.md) — Version history
- [Root DEVELOPMENT.md](../../DEVELOPMENT.md) — Monorepo-wide development guide
