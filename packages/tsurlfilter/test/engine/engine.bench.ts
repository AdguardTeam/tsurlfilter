/* eslint-disable max-len */
import { readFileSync } from 'node:fs';

import * as TsUrlFilterOld from 'tsurlfilter-v3';
import { test } from 'vitest';

import { Engine } from '../../src/engine/engine';

import { ENGINE_BENCH_OPTIONS } from './engine-bench-options';

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
