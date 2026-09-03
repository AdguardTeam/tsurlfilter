# AGENTS.md

## Project Overview

Benchmarks are **co-located inside the libraries they measure** as
`test/**/*.bench.ts` files. This directory no longer contains standalone
benchmark packages; it only holds supporting documentation
(`DEVELOPMENT.md`, `VITEST5-BENCHMARKS-RESEARCH.md`).

## Technical Context

- **Language/Version**: TypeScript, Node.js ≥ 22
- **Benchmark Framework**: Vitest 5 (`test(({ bench }) => …)` context fixture,
  Tinybench provider) — the only benchmark toolchain in the repository
- **Runner**: `vitest bench` (per-package `pnpm bench` script)
- **Linting**: ESLint (airbnb-typescript base), markdownlint
- **Target Platform**: Node.js; browser numbers via a Vitest `browser` project
  (`pnpm bench:browser`, Chromium via the Playwright provider)
- **Not published**: benchmark files are development/measurement tools

## Where benchmarks live

Benchmarks are authored with the Vitest 5 context-fixture API:

```ts
import { test } from 'vitest';

test('compare implementations', async ({ bench }) => {
    await bench.compare(
        bench('current', () => { doWork(); }),
        bench('previous', () => { doWorkPrevious(); }),
    );
});
```

Key files:

- `packages/agtree/test/*.bench.ts` — AGTree parse/convert (vs `agtree-v2`)
- `packages/css-tokenizer/test/tokenizer.bench.ts` — tokenizer vs competitors
- `packages/tsurlfilter/test/engine/*.bench.ts` — engine startup (vs
  `tsurlfilter-v3`)

## Build And Test Commands

From a package directory:

- `pnpm bench` — run Node benchmarks (console + JSON result)
- `pnpm bench:browser` — run the same files in Chromium
- `pnpm test` — run the regular test suite (bench files are not run as tests)

From the repository root:

- `npx lerna run bench` — run every package's `bench` target

Benchmark output is produced by Vitest's built-in `default` and `json`
reporters (written to `.vitest/bench/`); there is no custom Markdown-table
generator or system-spec collector.

## Contribution Instructions

- Benchmarks are development/measurement tools, not published packages.

- When making performance-related changes to a core package, run the relevant
  benchmark before and after to quantify the impact.

- A/B comparisons use npm-alias dev dependencies (e.g. `tsurlfilter-v3`,
  `agtree-v2`) driven through `bench.compare`. Keep alias versions up to date.

- Benchmarks are not a CI regression gate; they run manually/locally.

- Benchmarks that read fixture files via `node:fs` are Node-only; the browser
  project runs the subset that does not depend on Node APIs.
