/* eslint-disable max-len */
import { readFileSync } from 'node:fs';

import * as TsUrlFilterV6 from 'tsurlfilter-v6';
import { test } from 'vitest';

import { ENGINE_BENCH_OPTIONS } from './engine-bench-options';

// Compare the CURRENT (in-development) engine against the published 6.0.3
// baseline to surface the startup gains from agtree v5 and the other
// optimizations on this branch.
//
// `current` is imported from the BUILT `@adguard/tsurlfilter` package (its
// `exports` map resolves to `dist/`), NOT from `src/`. This is essential for a
// fair comparison: `tsurlfilter-v6` runs as an optimized published bundle, so
// the current code must be measured as its optimized bundle too. The Vite dep
// optimizer (see `vitest.config.ts`) pre-bundles both sides — including their
// transitive `@adguard/agtree` — so neither is deoptimized by module-by-module
// serving. Build the package before running this benchmark (see
// `packages/benchmarks/DEVELOPMENT.md`): inject a temporary version, then run
// `pnpm build`. The dynamic import below turns a missing/stale build into a
// clear error instead of a cryptic module-resolution failure.
const TSURLFILTER = await import('@adguard/tsurlfilter').catch((error: unknown) => {
    throw new Error(
        'Failed to resolve the built `@adguard/tsurlfilter` bundle. '
        + 'Build it first (inject a temporary version, then `pnpm build`) — '
        + 'see packages/benchmarks/DEVELOPMENT.md.',
        { cause: error },
    );
});

const { Engine } = TSURLFILTER;

// Fixture provenance: `test/resources/ag-base.txt` is a snapshot of the
// AdGuard Base filter list (https://github.com/AdguardTeam/AdGuardFilters),
// kept with its original CRLF line endings. A matching copy lives at
// `packages/agtree/test/fixtures/ag-base.txt` and is used by
// `parse-fixture.bench.ts`. To refresh, re-download the current base filter
// list from the AdGuardFilters repository and replace BOTH copies so the two
// benchmarks keep measuring the same corpus.
const ignoreCosmetic = false;
const rawFilter = readFileSync('test/resources/ag-base.txt', 'utf-8');

// Keep the timed work observable: each bench accumulates a cheap checksum here
// so the engine can't eliminate the closure, and we guard it after the run.
let resultSink = 0;

test('build engine (ag-base): current vs v6', async ({ bench }) => {
    await bench.compare(
        bench('v6 engine (sync)', () => {
            resultSink += TsUrlFilterV6.Engine.createSync({ filters: [{ id: 2, content: rawFilter, ignoreCosmetic }] }).getRulesCount();
        }),
        bench('current engine (sync)', () => {
            resultSink += Engine.createSync({ filters: [{ id: 2, content: rawFilter, ignoreCosmetic }] }).getRulesCount();
        }),
        bench('current engine (async)', async () => {
            const engine = await Engine.createAsync({ filters: [{ id: 2, content: rawFilter, ignoreCosmetic }] });
            resultSink += engine.getRulesCount();
        }),
        ENGINE_BENCH_OPTIONS,
    );

    if (resultSink === 0) {
        throw new Error('benchmark produced no observable results');
    }
});
