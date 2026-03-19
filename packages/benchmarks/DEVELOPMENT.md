# Development

This guide covers the development workflow for the benchmark packages in
`packages/benchmarks/`.

## Prerequisites

- **Node.js**: v22 or later
- **pnpm**: v10 (managed via the monorepo root)
- **Playwright**: required for browser-based benchmarks
  (`agtree-browser-benchmark`, `tsurlfilter-benchmark`)

## Getting Started

### Clone the Repository

The benchmarks live inside the `tsurlfilter` monorepo:

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

Benchmarks depend on the core packages they measure. Build them first:

```bash
# For agtree benchmarks
npx lerna run build --scope @adguard/agtree --include-dependencies

# For css-tokenizer benchmarks
npx lerna run build --scope @adguard/css-tokenizer --include-dependencies

# For tsurlfilter benchmarks
npx lerna run build --scope @adguard/tsurlfilter --include-dependencies
```

## Available Benchmarks

| Package | Description | Runner |
|---------|-------------|--------|
| `agtree-benchmark` | AGTree parser performance | `benchmark.js` |
| `agtree-browser-benchmark` | AGTree browser-based benchmarks | Playwright + `tinybench` |
| `css-tokenizer-benchmark` | CSS tokenizer vs. other tokenizers | `benchmark.js` |
| `tsurlfilter-benchmark` | TSUrlFilter engine benchmarks | `tinybench` + Playwright |

## Running Benchmarks

Each benchmark is run from its own directory:

```bash
# AGTree parser benchmarks
cd packages/benchmarks/agtree-benchmark
pnpm start

# AGTree browser benchmarks
cd packages/benchmarks/agtree-browser-benchmark
pnpm start

# CSS tokenizer benchmarks
cd packages/benchmarks/css-tokenizer-benchmark
pnpm start

# TSUrlFilter engine benchmarks
cd packages/benchmarks/tsurlfilter-benchmark
pnpm start
```

## Development Workflow

### Linting

Each benchmark has its own lint setup with ESLint, TypeScript type checking,
and markdownlint:

```bash
cd packages/benchmarks/<benchmark-name>
pnpm lint
```

Individual lint commands:

```bash
pnpm lint:code    # ESLint
pnpm lint:types   # TypeScript type checking
pnpm lint:md      # Markdownlint
```

### Version Aliases

Benchmarks compare the current version of a package against older published
versions using npm aliases:

- `agtree-v1`, `agtree-v2`, `agtree-v3` — older `@adguard/agtree` releases
- `tsurlfilter-v1`, `tsurlfilter-v2`, `tsurlfilter-v3` — older
  `@adguard/tsurlfilter` releases

Keep these aliases up to date when new major versions are released.

## Common Tasks

### Adding a New Benchmark

1. Create a new directory under `packages/benchmarks/`.
2. Add a `package.json` with `"private": "true"` and a `start` script.
3. Register the directory in `pnpm-workspace.yaml` (already covered by the
   `packages/benchmarks/*` glob).
4. Add benchmark source in `src/`.

### Updating Results

When benchmark results change significantly, update `RESULTS.md` (where
present) with the new numbers.

## Troubleshooting

### Issue: Dependencies fail to install

**Solution**: Clean and reinstall from the monorepo root:

```bash
pnpm ri
```

### Issue: Playwright not installed

**Solution**: Install Playwright browsers:

```bash
npx playwright install
```

## Additional Resources

- [AGENTS.md](AGENTS.md) — AI agent instructions for benchmarks
- [Root DEVELOPMENT.md](../../DEVELOPMENT.md) — Monorepo-wide development guide
