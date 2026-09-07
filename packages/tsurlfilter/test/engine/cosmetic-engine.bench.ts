/* eslint-disable max-len */
import { readFileSync } from 'node:fs';

import * as TsUrlFilterOld from 'tsurlfilter-v3';
import { test } from 'vitest';

import { CosmeticEngine } from '../../src/engine/cosmetic-engine/cosmetic-engine';
import { RuleStorage } from '../../src/filterlist/rule-storage';
import { ScannerType } from '../../src/filterlist/scanner/scanner-type';
import { StringRuleList } from '../../src/filterlist/string-rule-list';
import { type IndexedStorageCosmeticRuleParts } from '../../src/rules/rule';

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
        const scanner = storage.createRuleStorageScanner(ScannerType.CosmeticRules);
        const rulesParts: IndexedStorageCosmeticRuleParts[] = [];

        while (scanner.scan()) {
            // We can safely cast here, because we configured scanner to scan only cosmetic rules
            rulesParts.push(scanner.getRuleParts()! as IndexedStorageCosmeticRuleParts);
        }

        const engine = CosmeticEngine.createSync(rulesParts, storage);
        return engine;
    };

    await bench.compare(
        bench('v3 cosmetic engine', () => {
            createOldEngine();
        }),
        bench('current cosmetic engine', () => {
            createNewEngine();
        }),
        // See engine.bench.ts for why the iteration caps are needed.
        { iterations: 10, warmupIterations: 3 },
    );
});
