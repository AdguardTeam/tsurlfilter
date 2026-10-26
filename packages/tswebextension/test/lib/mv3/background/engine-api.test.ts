import {
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import { Filter } from '@adguard/dnr-converter';
import { Engine, FilterList } from '@adguard/tsurlfilter';

import { CanvasExceptionRules } from '../../../../src/lib/common/canvas-protection/exception-rules';
import { USER_FILTER_ID } from '../../../../src/lib/common/constants';
import { EngineApi } from '../../../../src/lib/mv3/background/engine-api';

describe('getDocumentOrStealthExceptionRuleTexts method', () => {
    it('delegates to the common extractor when the engine is started', async () => {
        const engineApi = new EngineApi();
        expect(engineApi.getDocumentOrStealthExceptionRuleTexts()).toEqual([]);
        const extract = vi.spyOn(CanvasExceptionRules, 'getRuleTexts')
            .mockReturnValueOnce(['@@||example.org^$stealth=fingerprinting']);

        await engineApi.startEngine({
            localFilters: [],
            remoteFilters: [],
            userRulesFilter: new Filter(
                USER_FILTER_ID,
                async () => new FilterList('', USER_FILTER_ID).getContent(),
            ),
            allowlistRulesList: null,
            verbose: false,
        });

        expect(engineApi.getDocumentOrStealthExceptionRuleTexts()).toEqual(['@@||example.org^$stealth=fingerprinting']);
        expect(extract).toHaveBeenCalledWith(expect.any(Engine));
        extract.mockRestore();
    });
});
