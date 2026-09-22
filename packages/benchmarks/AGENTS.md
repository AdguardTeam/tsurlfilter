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
  (`pnpm bench:browser`, Chromium and Firefox via the Playwright provider)
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

- `packages/agtree/test/parser.bench.ts`, `test/converter.bench.ts` — AGTree
  parse/convert vs `agtree-v2`, importing the current implementation from
  source
- `packages/agtree/test/parse-fixture.bench.ts` — full filter-list parse vs
  `agtree-v4` over the committed `ag-base` corpus, importing the **built**
  `@adguard/agtree` bundle
- `packages/agtree/test/converter-fixture.bench.ts` — whole-list and per-rule
  conversion vs `agtree-v4` over the committed uBO fixture, importing the
  **built** `@adguard/agtree` bundle (Node + Chromium/Firefox)
- `packages/css-tokenizer/test/tokenizer.bench.ts` — tokenizer vs competitors
- `packages/tsurlfilter/test/engine/*.bench.ts` — engine startup and request
  matching (vs `tsurlfilter-v3`, from source) and engine init vs
  `tsurlfilter-v6` (built bundle), Node only

See `DEVELOPMENT.md` for how to run them and the full workflow.

## Contribution Instructions

- Benchmarks are development/measurement tools, not published packages.

- When making performance-related changes to a core package, run the relevant
  benchmark before and after to quantify the impact.

- A/B comparisons use npm-alias dev dependencies (`agtree-v2`, `agtree-v4`,
  `tsurlfilter-v3`, `tsurlfilter-v6`) driven through `bench.compare`. Keep
  alias versions up to date and pin the published baselines exactly for
  stable A/B runs.

- Legacy inline benches import the current implementation from `src/`;
  full-list A/B benches (`parse-fixture.bench.ts`,
  `converter-fixture.bench.ts`, `engine-init.bench.ts`) import the current
  package from its **built** `dist/` bundle (via the package `exports` map) so
  it competes as an optimized bundle. Build the package before running the
  dist-importing benches.

- Benchmarks are not a CI regression gate; they run manually/locally.

- Node-only benchmarks (those reading fixtures via `node:fs`, or importing
  `tsurlfilter-v3`) are excluded from the browser project via
  `test.benchmark.exclude`; `tsurlfilter` has no browser project at all.

