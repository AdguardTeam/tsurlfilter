# Development

This guide covers the development workflow for benchmarks, which are now
**co-located** inside the libraries they measure as `test/**/*.bench.ts`.

## Prerequisites

- **Node.js**: v22 or later
- **pnpm**: v10 (managed via the monorepo root)
- **Playwright**: required for browser benchmarks (`pnpm bench:browser`),
  Chromium only for now

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

## Available Benchmarks

| Package | Benchmark file(s) | What it measures |
|---------|-------------------|------------------|
| `agtree` | `test/parser.bench.ts`, `test/converter.bench.ts` | AGTree parse/convert vs `agtree-v2` |
| `css-tokenizer` | `test/tokenizer.bench.ts` | Tokenizer vs `css-tree`, `@csstools/*`, `parse-css`, `csslex` |
| `tsurlfilter` | `test/engine/*.bench.ts` | Engine startup (network/cosmetic/engine) vs `tsurlfilter-v3` |

All benchmarks use Vitest 5's `test(({ bench }) => …)` context-fixture API and
`bench.compare()` for A/B comparisons.

## Running Benchmarks

From a package directory:

```bash
pnpm bench          # Node
pnpm bench:browser  # Chromium (Playwright provider)
```

To run every package's benchmarks from the monorepo root:

```bash
npx lerna run bench
```

Results are printed to the console and written as JSON under `.vitest/bench/`.

## Development Workflow

### Linting

Benchmark files are covered by each package's own lint setup (ESLint,
TypeScript type checking, and markdownlint):

```bash
cd packages/<package>
pnpm lint
```

### Version Aliases

Benchmarks compare the current version of a package against older published
versions using npm-alias dev dependencies:

- `agtree-v2` — older `@adguard/agtree` release
- `tsurlfilter-v3` — older `@adguard/tsurlfilter` release

Keep these aliases up to date when new major versions are released.

## Common Tasks

### Adding a New Benchmark

1. Add a `*.bench.ts` file under the package's `test/**` tree, authored with
   the Vitest 5 context-fixture API.
2. Ensure it is picked up by the package's `test.benchmark.include` glob
   (`test/**/*.bench.ts`).
3. If it imports fixtures via `node:fs`, it is Node-only; the browser project
   runs the subset without Node-API dependencies.

### Updating Results

There is no committed results file. Benchmark output comes from Vitest's
built-in reporters (console + JSON under `.vitest/bench/`).

## Troubleshooting

### Issue: Dependencies fail to install

**Solution**: Clean and reinstall from the monorepo root:

```bash
pnpm ri
```

### Issue: Playwright not installed

**Solution**: Install the Chromium browser:

```bash
npx playwright install chromium
```

## Additional Resources

- [AGENTS.md](AGENTS.md) — AI agent instructions for benchmarks
- [Root DEVELOPMENT.md](../../DEVELOPMENT.md) — Monorepo-wide development guide
