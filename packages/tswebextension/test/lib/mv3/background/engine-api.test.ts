import {
    afterEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import { type IFilter } from '@adguard/dnr-converter';
import { Engine } from '@adguard/tsurlfilter';

import { ALLOWLIST_FILTER_ID } from '../../../../src/lib/common/constants';
import { EngineApi } from '../../../../src/lib/mv3/background/engine-api';

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

describe('EngineApi.startEngine — exception sources', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('collects the allowlist lines of the local filters and the user rules', async () => {
        // The preregistered-scripts service derives the URL exclusions of a
        // registration from these lines, so a filter missing here silently
        // disables the exclusion it carries.
        vi.spyOn(Engine, 'createAsync').mockResolvedValue(undefined as never);

        const api = new EngineApi();
        await api.startEngine({
            verbose: false,
            localFilters: [makeFilter(2, [
                '||youtube.com^$script',
                '! a comment',
                '@@||youtube.com/my_video_ad$document',
            ].join('\n'))],
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

    it('starts empty, so a sync before the engine start registers no exclusions', () => {
        const api = new EngineApi();

        expect(api.getExceptionSources()).toEqual([]);
    });
});
