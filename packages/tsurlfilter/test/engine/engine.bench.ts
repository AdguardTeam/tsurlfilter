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

    await bench.compare(
        bench('old engine (v3)', () => {
            const engine = createOldEngine();
            engine.loadRules();
        }),
        bench('new engine (sync)', () => {
            Engine.createSync({ filters: [{ id: 2, content: rawFilter, ignoreCosmetic }] });
        }),
        bench('new engine (async)', async () => {
            await Engine.createAsync({ filters: [{ id: 2, content: rawFilter, ignoreCosmetic }] });
        }),
    );
});
