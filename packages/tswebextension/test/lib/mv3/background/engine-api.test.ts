import { describe, expect, it } from 'vitest';

import { Filter } from '@adguard/dnr-converter';
import { FilterList } from '@adguard/tsurlfilter';

import { USER_FILTER_ID } from '../../../../src/lib/common/constants';
import { EngineApi } from '../../../../src/lib/mv3/background/engine-api';

describe('getDocumentExceptionRuleTexts method', () => {
    it('returns exception texts without allowlist rules', async () => {
        const engineApi = new EngineApi();
        const ruleTexts = '@@||example.org^$stealth=fingerprinting\n||example.org^';

        await engineApi.startEngine({
            localFilters: [],
            remoteFilters: [],
            userRulesFilter: new Filter(
                USER_FILTER_ID,
                async () => new FilterList(ruleTexts, USER_FILTER_ID).getContent(),
            ),
            allowlistRulesList: '@@||allowed.org^$document',
            verbose: false,
        });

        expect(engineApi.getDocumentExceptionRuleTexts()).toEqual(['@@||example.org^$stealth=fingerprinting']);
    });

    it('returns no texts when engine is not started', () => {
        expect(new EngineApi().getDocumentExceptionRuleTexts()).toEqual([]);
    });
});
