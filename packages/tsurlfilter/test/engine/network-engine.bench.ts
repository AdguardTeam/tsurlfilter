/* eslint-disable max-len */
import { readFileSync } from 'node:fs';

import * as TsUrlFilterOld from 'tsurlfilter-v3';
import { test } from 'vitest';

import { NetworkEngine } from '../../src/engine/network-engine';
import { RuleStorage } from '../../src/filterlist/rule-storage';
import { ScannerType } from '../../src/filterlist/scanner/scanner-type';
import { StringRuleList } from '../../src/filterlist/string-rule-list';
import { type IndexedStorageNetworkRuleParts } from '../../src/rules/rule';

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
        const scanner = list.newScanner(ScannerType.NetworkRules);
        const rulesParts: IndexedStorageNetworkRuleParts[] = [];

        while (scanner.scan()) {
            // We can safely cast here, because we configured scanner to scan only network rules
            rulesParts.push(scanner.getRuleParts()! as IndexedStorageNetworkRuleParts);
        }

        const engine = NetworkEngine.createSync(rulesParts, storage);
        return engine;
    };

    await bench.compare(
        bench('old network engine (v3)', () => {
            createOldEngine();
        }),
        bench('new network engine', () => {
            createNewEngine();
        }),
    );
});
