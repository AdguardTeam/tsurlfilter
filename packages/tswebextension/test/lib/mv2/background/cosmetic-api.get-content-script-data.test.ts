import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import { EXTCSS_PROTOCOL } from '../../../../src/lib/common/message-constants';
import { tabsApi } from '../../../../src/lib/mv2/background/api';
import { appContext } from '../../../../src/lib/mv2/background/app-context';
import { type ConfigurationMV2Context } from '../../../../src/lib/mv2/background/configuration';
import { CosmeticApi } from '../../../../src/lib/mv2/background/cosmetic-api';
import { serializeExtCssForCode } from '../../../../src/lib/mv2/background/extcss-code';
import { TabsApi } from '../../../../src/lib/mv2/background/tabs/tabs-api';

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

        // The real rule extraction needs a full cosmetic result too.
        vi.spyOn(CosmeticApi, 'getExtCssRules').mockReturnValue(null);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('returns extCssRules: null and keeps the rules on the frame context', () => {
        const rules = ['.ad:has(.child) { display: none !important; }'];
        const getExtCssRulesSpy = vi.spyOn(CosmeticApi, 'getExtCssRules').mockReturnValue(rules);

        const data = CosmeticApi.getContentScriptData(frameUrl, tabId, frameId);

        expect(data.extCssRules).toBeNull();
        expect(getExtCssRulesSpy).toHaveBeenCalledTimes(1);
        expect(tabsApi.updateFrameContext).toHaveBeenCalledWith(tabId, frameId, {
            extCssData: { extCssRules: rules, areHitsStatsCollected: false },
        });
    });

    it('injects the on-demand rules when the frame has no context', () => {
        const rules = ['.ad:has(.child) { display: none !important; }'];
        vi.mocked(tabsApi.getFrameContext).mockReturnValue(undefined);
        vi.spyOn(CosmeticApi, 'getExtCssRules').mockReturnValue(rules);
        const injectSpy = vi.spyOn(TabsApi, 'injectScript').mockResolvedValue();

        CosmeticApi.getContentScriptData(frameUrl, tabId, frameId);

        expect(injectSpy).toHaveBeenCalledWith(
            tabId,
            frameId,
            serializeExtCssForCode(rules, false, EXTCSS_PROTOCOL),
        );
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
