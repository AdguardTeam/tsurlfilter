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
import FiltersApi from '../../../../src/lib/mv3/background/filters-api';

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

describe('startEngine method', () => {
    it('passes stored filter lists of local filters to the engine without preparing them again', async () => {
        const filterId = 2;
        const storedFilterList = new FilterList(
            '||example.org^',
            filterId,
            FilterList.createEmptyConversionData(),
        );
        const loadFilterContent = vi.spyOn(FiltersApi, 'loadFilterContent').mockResolvedValue(storedFilterList);
        const getContent = vi.fn(async () => '||example.org^');
        const createAsync = vi.spyOn(Engine, 'createAsync');

        const engineApi = new EngineApi();
        await engineApi.startEngine({
            localFilters: [new Filter(filterId, getContent)],
            remoteFilters: [],
            userRulesFilter: new Filter(USER_FILTER_ID, async () => ''),
            allowlistRulesList: null,
            verbose: false,
        });

        expect(loadFilterContent).toHaveBeenCalledWith(filterId);
        // The original spelling is needed only by the DNR converter.
        expect(getContent).not.toHaveBeenCalled();
        expect(createAsync).toHaveBeenCalledWith({
            filters: [expect.objectContaining({ id: filterId, content: storedFilterList })],
        });

        loadFilterContent.mockRestore();
        createAsync.mockRestore();
    });
});
