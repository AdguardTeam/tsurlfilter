# AGENTS.md

## Project Overview

The `packages/benchmarks/` directory contains performance benchmark suites for
measuring the speed and resource usage of AdGuard's content blocking libraries.
Each benchmark is a standalone workspace package that compares current versions
against previous releases and competing implementations.

## Technical Context

- **Language/Version**: TypeScript, Node.js ≥ 22
- **Benchmark Frameworks**: `benchmark.js`, `tinybench`
- **Runner**: `tsx` (direct TypeScript execution)
- **Linting**: ESLint (airbnb-typescript base), markdownlint
- **Target Platform**: Node.js (some benchmarks use Playwright for browser
  execution)
- **Project Type**: Benchmark packages inside the `tsurlfilter` pnpm monorepo
- **Not published**: These packages are private and not published to npm

## Project Structure

```text
packages/benchmarks/
├── agtree-benchmark/            # AGTree parser performance benchmarks
│   ├── src/                     # Benchmark source code
│   ├── RESULTS.md               # Benchmark results
│   └── package.json
├── agtree-browser-benchmark/    # AGTree browser-based benchmarks (Playwright)
│   ├── src/                     # Benchmark source code
│   └── package.json
├── css-tokenizer-benchmark/     # CSS tokenizer benchmarks (vs other tokenizers)
│   ├── src/                     # Benchmark source code
│   └── package.json
└── tsurlfilter-benchmark/       # TSUrlFilter engine benchmarks
    ├── src/                     # Benchmark source code
    └── package.json
```

## Build And Test Commands

Each benchmark is run from its own directory:

- `pnpm start` — run the benchmark suite
- `pnpm lint` — run ESLint, TypeScript type checking, and markdownlint

## Contribution Instructions

- These are development/measurement tools, not published packages.

- When making performance-related changes to a core package, run the relevant
  benchmark before and after to quantify the impact.

- Update `RESULTS.md` (where present) if benchmark results change
  significantly.

- Benchmarks compare against older published versions of the same package
  (aliased as `agtree-v1`, `tsurlfilter-v3`, etc.). Keep version aliases
  up to date.
