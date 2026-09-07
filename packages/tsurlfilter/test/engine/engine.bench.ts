/* eslint-disable max-len */
import { readFileSync } from 'node:fs';

import * as TsUrlFilterOld from 'tsurlfilter-v3';
import { test } from 'vitest';

import { Engine } from '../../src/engine/engine';

const ignoreCosmetic = false;
const rawFilter = readFileSync('test/resources/adguard_base_filter.txt', 'utf-8');

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

    // Each engine build takes ~200-400 ms on the base filter; cap tinybench's
    // run (its default is 64 iterations + 16 warmup per benchmark, which would
    // blow past the 60s bench-mode test timeout). The trailing options are the
    // bench-level run config `bench.compare` forwards to the tinybench provider.
    await bench.compare(
        bench('v3 engine', () => {
            const engine = createOldEngine();
            engine.loadRules();
        }),
        bench('current engine (sync)', () => {
            Engine.createSync({ filters: [{ id: 2, content: rawFilter, ignoreCosmetic }] });
        }),
        bench('current engine (async)', async () => {
            await Engine.createAsync({ filters: [{ id: 2, content: rawFilter, ignoreCosmetic }] });
        }),
        { iterations: 10, warmupIterations: 3 },
    );
});
