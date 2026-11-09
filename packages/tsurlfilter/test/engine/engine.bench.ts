/* eslint-disable max-len */
import { readFileSync } from 'node:fs';

import * as TsUrlFilterOld from 'tsurlfilter-v3';
import { test } from 'vitest';

import { ENGINE_BENCH_OPTIONS } from './engine-bench-options';

// `current` is imported from the BUILT `@adguard/tsurlfilter` package
// (its `exports` map resolves to `dist/`), NOT from `src/`. Vite serves
// `src/` module-by-module and deoptimizes cross-module calls, which
// inflates the current leg 1.7–11×; the published baselines are optimized
// bundles, so the current code must be measured as its bundle too. Build
// the package before running this benchmark (see
// `packages/benchmarks/DEVELOPMENT.md`). The dynamic import turns a
// missing/stale build into a clear error instead of a cryptic
// module-resolution failure.
const TSURLFILTER = await import('@adguard/tsurlfilter').catch((error: unknown) => {
    throw new Error(
        'Failed to resolve the built `@adguard/tsurlfilter` bundle. '
        + 'Build it first (inject a temporary version, then `pnpm build`) — '
        + 'see packages/benchmarks/DEVELOPMENT.md.',
        { cause: error },
    );
});

const { Engine } = TSURLFILTER;

const ignoreCosmetic = false;
const rawFilter = readFileSync('test/resources/adguard_base_filter.txt', 'utf-8');

// Keep the timed work observable: each bench accumulates a cheap checksum here
// so the engine can't eliminate the closure, and we guard it after the run.
let resultSink = 0;

test('build engine: current vs v3', async ({ bench }) => {
    const preprocessed = TsUrlFilterOld.FilterListPreprocessor.preprocess(rawFilter);

    const createOldEngine = () => {
        const list = new TsUrlFilterOld.BufferRuleList(
            2,
            preprocessed.filterList,
            ignoreCosmetic,
            false,
            false,
            preprocessed.sourceMap,
        );
        const storage = new TsUrlFilterOld.RuleStorage([list]);
        return new TsUrlFilterOld.Engine(storage, true);
    };

    await bench.compare(
        bench('v3 engine', () => {
            const engine = createOldEngine();
            engine.loadRules();
            resultSink += engine.getRulesCount();
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
