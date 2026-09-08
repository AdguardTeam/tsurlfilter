/* eslint-disable max-len */
import { readFileSync } from 'node:fs';

import * as TsUrlFilterOld from 'tsurlfilter-v3';
import { test } from 'vitest';

import { CosmeticEngine } from '../../src/engine/cosmetic-engine/cosmetic-engine';
import { RuleStorage } from '../../src/filterlist/rule-storage';
import { ScannerType } from '../../src/filterlist/scanner/scanner-type';
import { StringRuleList } from '../../src/filterlist/string-rule-list';
import { type IndexedStorageCosmeticRuleParts } from '../../src/rules/rule';

import { ENGINE_BENCH_OPTIONS } from './engine-bench-options';
import { collectRuleParts } from './rule-parts';

// Keep the timed work observable: each bench accumulates a cheap checksum here
// so the engine can't eliminate the closure, and we guard it after the run.
let resultSink = 0;

test('build cosmetic engine: current vs v3', async ({ bench }) => {
    const rawFilter = readFileSync('test/resources/adguard_base_filter.txt', 'utf-8');
    const preprocessedFilter = TsUrlFilterOld.FilterListPreprocessor.preprocess(rawFilter);

    const createOldEngine = () => {
        const list = new TsUrlFilterOld.BufferRuleList(
            2,
            preprocessedFilter.filterList,
            false,
            false,
            false,
            preprocessedFilter.sourceMap,
        );
        const storage = new TsUrlFilterOld.RuleStorage([list]);
        const engine = new TsUrlFilterOld.CosmeticEngine(storage, false);
        return engine;
    };

    const createNewEngine = () => {
        const list = new StringRuleList(
            2,
            rawFilter,
            false,
            false,
            false,
        );
        const storage = new RuleStorage([list]);
        const rulesParts = collectRuleParts<IndexedStorageCosmeticRuleParts>(storage, ScannerType.CosmeticRules);

        const engine = CosmeticEngine.createSync(rulesParts, storage);
        return engine;
    };

    await bench.compare(
        bench('v3 cosmetic engine', () => {
            resultSink += createOldEngine().rulesCount;
        }),
        bench('current cosmetic engine', () => {
            resultSink += createNewEngine().rulesCount;
        }),
        ENGINE_BENCH_OPTIONS,
    );

    if (resultSink === 0) {
        throw new Error('benchmark produced no observable results');
    }
});
