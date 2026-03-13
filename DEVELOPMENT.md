# Development

This guide covers the development workflow, environment setup, and common tasks
for contributing to the `tsurlfilter` monorepo.

## Prerequisites

- **Node.js**: v22 or later (use [nvm](https://github.com/nvm-sh/nvm) to
  manage versions)
- **pnpm**: v10 (see [pnpm installation](https://pnpm.io/installation))
- **Git**: latest stable version
- **OS**: macOS or Linux (some commands may not work on Windows without WSL)

## Getting Started

### Clone the Repository

```bash
git clone https://github.com/AdguardTeam/tsurlfilter.git
cd tsurlfilter
```

### Install Dependencies

```bash
pnpm install
```

This installs dependencies for all packages in the monorepo. Shared dependency
versions are managed via [pnpm catalogs](https://pnpm.io/catalogs) in
`pnpm-workspace.yaml`.

### Build All Packages

```bash
npx lerna run build
```

Lerna + Nx respect the dependency tree and cache build outputs, so packages are
built in the correct order automatically.

### Build a Specific Package

```bash
npx lerna run build --scope=<package-name>
```

For example:

```bash
npx lerna run build --scope=@adguard/tsurlfilter
```

Lerna automatically builds the package's workspace dependencies first.

## Development Workflow

### Branch Strategy

- Create feature branches from `master`
- Use descriptive branch names: `feature/add-auth`, `fix/login-bug`,
  `enhance/improve-performance`
- Open a pull request when ready for review

### Code Style

Each package has its own ESLint configuration (most use `airbnb-typescript`
base). Common rules across the monorepo:

- TypeScript strict mode enabled
- JSDoc required on exported APIs (enforced by `eslint-plugin-jsdoc`)
- 4-space indentation, single quotes, semicolons

### Linting

```bash
# Lint all packages
pnpm lint

# Lint a specific package (from its directory)
pnpm lint:code   # ESLint only
pnpm lint:types  # TypeScript type checking only
```

### Running Tests

```bash
# Run tests in all packages
npx lerna run test

# Run tests in a specific package (from its directory)
pnpm test
```

For `@adguard/tsurlfilter` and `@adguard/tswebextension`, build first, then
run the full validation:

```bash
pnpm build
pnpm test:prod   # lint + smoke tests + full test suite (no cache)
```

### Building for Production

```bash
# Build all packages
npx lerna run build

# Pack release tarballs (dnr-rulesets, api, api-mv3 with dependencies)
pnpm tgz
```

## Common Tasks

### Adding or Updating a Shared Dependency

Shared dependency versions are managed via pnpm catalogs in
`pnpm-workspace.yaml`. To update a common dependency:

1. Edit the version in the `catalog:` section of `pnpm-workspace.yaml`.
2. Run `pnpm install` to update the lockfile.
3. Verify affected packages still build and pass tests.

### Adding a New Internal Dependency

Use `workspace:^` for cross-package references:

```json
{
  "dependencies": {
    "@adguard/agtree": "workspace:^"
  }
}
```

### Incrementing a Package Version

```bash
pnpm run increment <package-name>
```

This increments the patch or prerelease version of the specified package.

### Clean Reinstall

```bash
# Remove all node_modules across the monorepo
pnpm clean

# Or clean and reinstall in one step
pnpm reinstall   # (alias: pnpm ri)
```

### Working with Sample Extensions

Source code is in `packages/examples/`. Build them with:

```bash
npx lerna run build --scope tswebextension-mv2
npx lerna run build --scope tswebextension-mv3
npx lerna run build --scope adguard-api-example
npx lerna run build --scope adguard-api-mv3-example
```

Built extensions are output to each example's `build/` directory and can be
loaded as unpacked extensions in the browser. Use
[test pages](https://testcases.agrd.dev) to validate filtering.

### Running Benchmarks

Each benchmark is run from its own directory under `packages/benchmarks/`:

```bash
cd packages/benchmarks/agtree-benchmark
pnpm start
```

### IDE Setup (VS Code)

Create a `tsurlfilter.code-workspace` file in the monorepo root:

```json
{
    "folders": [
        { "path": "packages/logger" },
        { "path": "packages/css-tokenizer" },
        { "path": "packages/agtree" },
        { "path": "packages/tsurlfilter" },
        { "path": "packages/tswebextension" },
        { "path": "packages/dnr-rulesets" },
        { "path": "packages/adguard-api" },
        { "path": "packages/adguard-api-mv3" },
        { "path": "packages/examples/adguard-api" },
        { "path": "packages/examples/adguard-api-mv3" },
        { "path": "packages/examples/tswebextension-mv2" },
        { "path": "packages/examples/tswebextension-mv3" }
    ]
}
```

Recommended extensions are listed in `.vscode/extensions.json`.

## Troubleshooting

### Issue: Dependencies fail to install

**Solution**: Clean and reinstall from the monorepo root:

```bash
pnpm ri
```

### Issue: Build fails with workspace dependency errors

**Solution**: Ensure workspace dependencies are built first. Use Lerna to build
a package with its dependencies:

```bash
npx lerna run build --scope=<package-name> --include-dependencies
```

### Issue: Mismatched `zod` versions inflate bundle size

**Solution**: All packages must use the same `zod` version, managed via pnpm
catalogs in `pnpm-workspace.yaml`. Do not pin a different version in individual
packages. Duplicate versions get bundled separately, increasing the final bundle
size.

### Issue: Git pre-commit hook modifies `package.json`

This is expected. The pre-commit hook strips the `packageManager` field from
`package.json` before committing and restores it afterward.

### Issue: Linking packages to non-pnpm projects

**Solution**: Use `--shamefully-hoist` to create a flat `node_modules`
structure compatible with other package managers:

```bash
pnpm install --shamefully-hoist
```

For pnpm-based projects, use [`pnpm link`](https://pnpm.io/cli/link).

## Additional Resources

- [README.md](README.md) — Project overview and package listing
- [AGENTS.md](AGENTS.md) — AI agent instructions and code guidelines
- [Lerna Commands](https://lerna.js.org/docs/api-reference/commands) — Lerna CLI
  reference
- [pnpm Catalogs](https://pnpm.io/catalogs) — Shared dependency version
  management
