/* eslint-disable max-len */
// pnpm vitest bench network-lookup
import { bench, describe, vi } from 'vitest';
import * as TsUrlFilterOld from 'tsurlfilter-old';

import { readFileSync } from 'node:fs';
import { setLogger } from '../../src/utils/logger';
import { RuleStorage } from '../../src/filterlist/rule-storage';
import { StringRuleList } from '../../src/filterlist/string-rule-list';
import { NetworkEngine } from '../../src/engine/network-engine';

describe('Build network engine', () => {
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

    const rawFilter = readFileSync('test/resources/adguard_base_filter.txt', 'utf-8');
    const preprocessed = TsUrlFilterOld.FilterListPreprocessor.preprocess(rawFilter);

    bench('old network engine', () => {
        const list = new TsUrlFilterOld.BufferRuleList(2, preprocessed.filterList, false, false, false, preprocessed.sourceMap);
        const storage = new TsUrlFilterOld.RuleStorage([list]);
        new TsUrlFilterOld.NetworkEngine(storage, false);
    });

    bench('new network engine', () => {
        const list = new StringRuleList(2, rawFilter, false, false, false);
        const storage = new RuleStorage([list]);
        new NetworkEngine(storage, false);
    });
});
