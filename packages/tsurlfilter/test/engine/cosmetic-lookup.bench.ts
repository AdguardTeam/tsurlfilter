/* eslint-disable max-len */
// pnpm vitest bench cosmetic-lookup
import { bench, describe, vi } from 'vitest';
import * as TsUrlFilterOld from 'tsurlfilter-old';
import { readFileSync } from 'node:fs';

import { setLogger } from '../../src/utils/logger';
import { CosmeticEngine } from '../../src/engine/cosmetic-engine/cosmetic-engine';
import { RuleStorage } from '../../src/filterlist/rule-storage';
import { StringRuleList } from '../../src/filterlist/string-rule-list';

describe('Build cosmetics engine', () => {
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

    bench('old cosmetic engine', () => {
        const list = new TsUrlFilterOld.BufferRuleList(2, preprocessed.filterList, false, false, false, preprocessed.sourceMap);
        const storage = new TsUrlFilterOld.RuleStorage([list]);
        new TsUrlFilterOld.CosmeticEngine(storage, false);
    });

    bench('new cosmetic engine', () => {
        const list = new StringRuleList(2, rawFilter, false, false, false);
        const storage = new RuleStorage([list]);
        new CosmeticEngine(storage, false);
    });
});
