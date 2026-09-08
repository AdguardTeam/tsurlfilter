/* eslint-disable max-len */
import { readFileSync } from 'node:fs';

import * as TsUrlFilterOld from 'tsurlfilter-v3';
import { test } from 'vitest';

import { NetworkEngine } from '../../src/engine/network-engine';
import { RuleStorage } from '../../src/filterlist/rule-storage';
import { ScannerType } from '../../src/filterlist/scanner/scanner-type';
import { StringRuleList } from '../../src/filterlist/string-rule-list';
import { type IndexedStorageNetworkRuleParts } from '../../src/rules/rule';

import { ENGINE_BENCH_OPTIONS } from './engine-bench-options';
import { collectRuleParts } from './rule-parts';

// Keep the timed work observable: each bench accumulates a cheap checksum here
// so the engine can't eliminate the closure, and we guard it after the run.
let resultSink = 0;

test('build network engine: current vs v3', async ({ bench }) => {
    const ignoreCosmetic = true;

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
        const engine = new TsUrlFilterOld.NetworkEngine(storage, false);
        return engine;
    };

    const createNewEngine = () => {
        const list = new StringRuleList(
            2,
            rawFilter,
            ignoreCosmetic,
            false,
            false,
        );
        const storage = new RuleStorage([list]);
        const rulesParts = collectRuleParts<IndexedStorageNetworkRuleParts>(storage, ScannerType.NetworkRules);

        const engine = NetworkEngine.createSync(rulesParts, storage);
        return engine;
    };

    await bench.compare(
        bench('v3 network engine', () => {
            resultSink += createOldEngine().rulesCount;
        }),
        bench('current network engine', () => {
            resultSink += createNewEngine().rulesCount;
        }),
        ENGINE_BENCH_OPTIONS,
    );

    if (resultSink === 0) {
        throw new Error('benchmark produced no observable results');
    }
});
