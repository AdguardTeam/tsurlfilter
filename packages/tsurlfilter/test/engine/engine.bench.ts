/* eslint-disable no-console */
/* eslint-disable max-len */
// pnpm vitest bench engine
import { readFileSync } from 'node:fs';
import * as TsUrlFilterOld from 'tsurlfilter-v3';
import { bench, describe } from 'vitest';

import { Engine } from '../../src/engine/engine';

describe('Build engine', () => {
    const ignoreCosmetic = false;

    const rawFilter = readFileSync('test/resources/adguard_base_filter.txt', 'utf-8');
    const preprocessedFilter = TsUrlFilterOld.FilterListPreprocessor.preprocess(rawFilter);

    const createOldEngine = () => {
        const list = new TsUrlFilterOld.BufferRuleList(
            2,
            preprocessedFilter.filterList,
            ignoreCosmetic,
            false,
            false,
            preprocessedFilter.sourceMap,
        );
        const storage = new TsUrlFilterOld.RuleStorage([list]);
        const engine = new TsUrlFilterOld.Engine(storage, true);
        return engine;
    };

    const createNewEngine = () => {
        return Engine.createSync({
            filters: [{
                id: 2,
                text: rawFilter,
                ignoreCosmetic,
            }],
        });
    };

    const oldEngine = createOldEngine();
    const newEngine = createNewEngine();

    oldEngine.loadRules();

    console.log('Old rules count:', oldEngine.getRulesCount());
    console.log('New rules count:', newEngine.getRulesCount());

    bench('old engine', () => {
        const engine = createOldEngine();
        engine.loadRules();
    });

    bench('new engine (sync)', () => {
        createNewEngine();
    });

    bench('new engine (async)', async () => {
        await Engine.createAsync({
            filters: [{
                id: 2,
                text: rawFilter,
                ignoreCosmetic,
            }],
        });
    });
});
