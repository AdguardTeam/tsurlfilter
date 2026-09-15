/* eslint-disable max-len */
import { readFileSync } from 'node:fs';

import * as TsUrlFilterV6 from 'tsurlfilter-v6';
import { test } from 'vitest';

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
// serving. Build the package before running this benchmark: `pnpm build`.
import { Engine } from '@adguard/tsurlfilter';

import { ENGINE_BENCH_OPTIONS } from './engine-bench-options';

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
