import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import { tabsApi } from '../../../../src/lib/mv2/background/api';
import { appContext } from '../../../../src/lib/mv2/background/app-context';
import { type ConfigurationMV2Context } from '../../../../src/lib/mv2/background/configuration';
import { CosmeticApi } from '../../../../src/lib/mv2/background/cosmetic-api';

vi.mock('../../../../src/lib/mv2/background/api', () => ({
    engineApi: {
        matchCosmetic: vi.fn(),
    },
    tabsApi: {
        getTabContext: vi.fn(),
        getFrameContext: vi.fn(),
        updateFrameContext: vi.fn(),
    },
}));

vi.mock('../../../../src/lib/mv2/background/app-context', async () => {
    const { MockAppContext } = await import('./mocks/mock-app-context');
    return {
        appContext: new MockAppContext(),
    };
});

vi.mock('../../../../src/lib/mv2/background/services/local-script-rules-service', () => ({
    localScriptRulesService: {},
}));

describe('CosmeticApi.getContentScriptData', () => {
    const frameUrl = 'https://example.com/';
    const tabId = 1;
    const frameId = 0;

    beforeEach(() => {
        vi.restoreAllMocks();
        vi.mocked(tabsApi.getTabContext).mockReset();
        vi.mocked(tabsApi.getFrameContext).mockReset();
        vi.mocked(tabsApi.updateFrameContext).mockReset();

        appContext.isStorageInitialized = true;
        appContext.isAppStarted = true;
        appContext.configuration = {
            settings: {
                collectStats: false,
            },
        } as unknown as ConfigurationMV2Context;

        vi.mocked(tabsApi.getTabContext).mockReturnValue({
            info: { url: frameUrl },
        } as ReturnType<typeof tabsApi.getTabContext>);
        vi.mocked(tabsApi.getFrameContext).mockReturnValue({
            cosmeticResult: {},
        } as ReturnType<typeof tabsApi.getFrameContext>);

        // The real selector extraction needs a full cosmetic result; this
        // suite only cares that the native path still runs.
        vi.spyOn(CosmeticApi, 'getNativeCssSelectors').mockReturnValue(null);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('returns extCssRules: null and does NOT compute ExtCSS rules', () => {
        const getExtCssRulesSpy = vi.spyOn(CosmeticApi, 'getExtCssRules');

        const data = CosmeticApi.getContentScriptData(frameUrl, tabId, frameId);

        expect(data.extCssRules).toBeNull();
        expect(getExtCssRulesSpy).not.toHaveBeenCalled();
    });

    it('still returns native CSS selectors for content-script repair', () => {
        const selectors = ['.ad', '.banner'];
        const getNativeCssSelectorsSpy = vi
            .spyOn(CosmeticApi, 'getNativeCssSelectors')
            .mockReturnValue(selectors);

        const data = CosmeticApi.getContentScriptData(frameUrl, tabId, frameId);

        expect(getNativeCssSelectorsSpy).toHaveBeenCalledTimes(1);
        expect(data.nativeCssSelectors).toEqual(selectors);
    });

    it('returns areHitsStatsCollected from settings', () => {
        appContext.configuration = {
            settings: {
                collectStats: true,
            },
        } as unknown as ConfigurationMV2Context;

        const data = CosmeticApi.getContentScriptData(frameUrl, tabId, frameId);

        expect(data.areHitsStatsCollected).toBe(true);
    });

    it('returns null nativeCssSelectors when the tab context is missing', () => {
        vi.mocked(tabsApi.getTabContext).mockReturnValue(undefined);
        const getNativeCssSelectorsSpy = vi.spyOn(CosmeticApi, 'getNativeCssSelectors');

        const data = CosmeticApi.getContentScriptData(frameUrl, tabId, frameId);

        expect(data.nativeCssSelectors).toBeNull();
        expect(getNativeCssSelectorsSpy).not.toHaveBeenCalled();
    });
});
