import {
    afterEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import { Filter, type IFilter } from '@adguard/dnr-converter';
import { Engine, FilterList } from '@adguard/tsurlfilter';

import { CanvasExceptionRules } from '../../../../src/lib/common/canvas-protection/exception-rules';
import { ALLOWLIST_FILTER_ID, USER_FILTER_ID } from '../../../../src/lib/common/constants';
import { EngineApi } from '../../../../src/lib/mv3/background/engine-api';
import FiltersApi from '../../../../src/lib/mv3/background/filters-api';

/**
 * Builds a minimal filter stub.
 *
 * @param id Filter id.
 * @param content Filter list content.
 *
 * @returns Filter stub.
 */
const makeFilter = (id: number, content: string): IFilter => ({
    getId: (): number => id,
    getContent: async (): Promise<string> => content,
    unloadContent: async (): Promise<void> => undefined,
});

/**
 * Stubs the stored-filter lookup `startEngine()` reads the local filter
 * content from: the engine takes the prepared `FilterList` and the scan reads
 * its text.
 *
 * @param lists Filter id → filter text.
 */
const setupStoredFilters = (lists: Record<number, string>): void => {
    vi.spyOn(FiltersApi, 'loadFilterContent').mockImplementation(async (filterId: number) => {
        const content = lists[filterId];
        if (content === undefined) {
            throw new Error(`Filter with id ${filterId} not found`);
        }
        return new FilterList(content, filterId, FilterList.createEmptyConversionData());
    });
};

describe('EngineApi.startEngine — exception sources', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('collects the allowlist lines of the local filters and the user rules', async () => {
        // The preregistered-scripts service derives the URL exclusions of a
        // registration from these lines, so a filter missing here silently
        // disables the exclusion it carries.
        vi.spyOn(Engine, 'createAsync').mockResolvedValue(undefined as never);
        setupStoredFilters({
            2: [
                '||youtube.com^$script',
                '! a comment',
                '@@||youtube.com/my_video_ad$document',
            ].join('\n'),
        });

        const api = new EngineApi();
        await api.startEngine({
            verbose: false,
            localFilters: [makeFilter(2, '')],
            remoteFilters: [],
            userRulesFilter: makeFilter(0, '@@||youtube.com/watch$document'),
            allowlistRulesList: null,
        });

        // Blocking rules and comments never decide the JS verdict, so only
        // the candidate lines are kept.
        expect(api.getExceptionSources()).toEqual([
            { filterId: 2, lines: ['@@||youtube.com/my_video_ad$document'] },
            { filterId: 0, lines: ['@@||youtube.com/watch$document'] },
        ]);
    });

    it('keeps the written text of a converted local filter', async () => {
        // `$badfilter` compares the rule as written, and the stored list is
        // converted: `$3p` becomes `$third-party`, so the converted line no
        // longer cancels the exception the engine cancels.
        vi.spyOn(Engine, 'createAsync').mockResolvedValue(undefined as never);
        const stored = new FilterList('@@||youtube.com/ads$document,3p', 2);
        expect(stored.getContent()).not.toBe(stored.getOriginalContent());
        vi.spyOn(FiltersApi, 'loadFilterContent').mockResolvedValue(stored);

        const api = new EngineApi();
        await api.startEngine({
            verbose: false,
            localFilters: [makeFilter(2, '')],
            remoteFilters: [],
            userRulesFilter: makeFilter(0, ''),
            allowlistRulesList: null,
        });

        expect(api.getExceptionSources()).toEqual([
            { filterId: 2, lines: ['@@||youtube.com/ads$document,3p'] },
        ]);
    });

    it('collects the generated rule of the user allowlist', async () => {
        // The allowlist is a document-level exception on the hosts the user
        // allowlisted: the engine disables JS there, so the scan has to see it.
        vi.spyOn(Engine, 'createAsync').mockResolvedValue(undefined as never);

        const api = new EngineApi();
        await api.startEngine({
            verbose: false,
            localFilters: [],
            remoteFilters: [],
            userRulesFilter: makeFilter(0, ''),
            allowlistRulesList: '@@///(www\\.)?youtube\\.com/$document,important',
        });

        expect(api.getExceptionSources()).toEqual([{
            filterId: ALLOWLIST_FILTER_ID,
            lines: ['@@///(www\\.)?youtube\\.com/$document,important'],
        }]);
    });

    it('skips a list it cannot read instead of failing the start', async () => {
        // An unreadable list is absent from the engine as well, so the scan
        // must miss its lines too — and the engine start must survive.
        vi.spyOn(Engine, 'createAsync').mockResolvedValue(undefined as never);

        // Filter 3 has no stored content, so loading it throws; filter 2 is
        // readable.
        setupStoredFilters({ 2: '@@||youtube.com/ads$document' });

        const api = new EngineApi();
        await api.startEngine({
            verbose: false,
            localFilters: [makeFilter(3, ''), makeFilter(2, '')],
            remoteFilters: [],
            userRulesFilter: makeFilter(0, ''),
            allowlistRulesList: null,
        });

        expect(api.getExceptionSources()).toEqual([
            { filterId: 2, lines: ['@@||youtube.com/ads$document'] },
        ]);
    });

    it('starts empty, so a sync before the engine start registers no exclusions', () => {
        const api = new EngineApi();

        expect(api.getExceptionSources()).toEqual([]);
    });
});

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
