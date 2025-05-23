/* eslint-disable max-len */
// pnpm vitest bench engine
import { bench, describe, vi } from 'vitest';
import * as TsUrlFilterOld from 'tsurlfilter-old';

import { readFileSync } from 'node:fs';
import { setLogger } from '../../src/utils/logger';
import { Engine } from '../../src/engine/engine';

describe('Build engine', () => {
    setLogger({
        error: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
    });

    TsUrlFilterOld.setLogger({
        error: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
    });

    const rawFilter = readFileSync('test/resources/filter.txt', 'utf-8');

    const preprocessed = TsUrlFilterOld.FilterListPreprocessor.preprocess(rawFilter);
    let list: TsUrlFilterOld.BufferRuleList;
    let storage: TsUrlFilterOld.RuleStorage;

    const oldEngineSetup = () => {
        list = new TsUrlFilterOld.BufferRuleList(2, preprocessed.filterList, false, false, false, preprocessed.sourceMap);
        storage = new TsUrlFilterOld.RuleStorage([list]);
    };

    oldEngineSetup();

    // number of rules
    const oldEngine = new TsUrlFilterOld.Engine(storage!, false);
    const oldRulesCount = oldEngine.getRulesCount();

    const newEngine = new Engine({
        filters: [{
            id: 2,
            text: rawFilter,
        }],
        skipInitialScan: false,
    });
    const newRulesCount = newEngine.getRulesCount();

    console.log('Old rules count:', oldRulesCount);
    console.log('New rules count:', newRulesCount);

    bench('old engine', () => {
        oldEngineSetup();
        new TsUrlFilterOld.Engine(storage, false);
    });

    bench('new engine', () => {
        new Engine({
            filters: [{
                id: 2,
                text: rawFilter,
            }],
            skipInitialScan: false,
        });
    });
});
