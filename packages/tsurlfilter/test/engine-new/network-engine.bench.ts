/* eslint-disable no-console */
/* eslint-disable max-len */
// pnpm vitest bench network-engine
import { readFileSync } from 'node:fs';
import * as TsUrlFilterOld from 'tsurlfilter-v3';
import { bench, describe } from 'vitest';

import { NetworkEngine } from '../../src/engine-new/network-engine';
import { RuleStorage } from '../../src/filterlist/rule-storage-new';
import { ScannerType } from '../../src/filterlist/scanner-new/scanner-type';
import { StringRuleList } from '../../src/filterlist/string-rule-list';
import { type IndexedStorageRule } from '../../src/rules/rule-new';

describe('Build engine', () => {
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
        const rules: IndexedStorageRule[] = [];

        while (scanner.scan()) {
            rules.push(scanner.getRule()!);
        }

        const engine = NetworkEngine.createSync(storage, rules);
        return engine;
    };

    console.log('Old rules count:', createOldEngine().rulesCount);
    console.log('New rules count:', createNewEngine().rulesCount);

    bench('old engine', () => {
        createOldEngine();
    });

    bench('new engine', () => {
        createNewEngine();
    });
});
