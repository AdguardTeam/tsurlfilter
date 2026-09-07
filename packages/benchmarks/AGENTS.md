# AGENTS.md

## Project Overview

Benchmarks are **co-located inside the libraries they measure** as
`test/**/*.bench.ts` files. This directory no longer contains standalone
benchmark packages; it only holds the benchmark development guide
(`DEVELOPMENT.md`).

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
  `tsurlfilter-v3`, Node only)

See `DEVELOPMENT.md` for how to run them and the full workflow.

## Contribution Instructions

- Benchmarks are development/measurement tools, not published packages.

- When making performance-related changes to a core package, run the relevant
  benchmark before and after to quantify the impact.

- A/B comparisons use npm-alias dev dependencies (e.g. `tsurlfilter-v3`,
  `agtree-v2`) driven through `bench.compare`. Keep alias versions up to date.

- Benchmarks are not a CI regression gate; they run manually/locally.

- Node-only benchmarks (those reading fixtures via `node:fs`, or importing
  `tsurlfilter-v3`) are excluded from the browser project via
  `test.benchmark.exclude`; `tsurlfilter` has no browser project at all.

