import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import { ExtCssMarkersState } from '../../../../src/lib/common/cosmetic-api';
import { EXTCSS_PROTOCOL } from '../../../../src/lib/common/extcss-protocol';
import { tabsApi } from '../../../../src/lib/mv2/background/api';
import { appContext } from '../../../../src/lib/mv2/background/app-context';
import { type ConfigurationMV2Context } from '../../../../src/lib/mv2/background/configuration';
import { CosmeticApi } from '../../../../src/lib/mv2/background/cosmetic-api';
import { serializeExtCssForCode } from '../../../../src/lib/mv2/background/extcss-code';
import { FrameMV2 } from '../../../../src/lib/mv2/background/tabs/frame';
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

    /**
     * Creates a frame context whose ExtendedCSS data was resolved on demand.
     *
     * @param extCssRules ExtendedCSS rule strings of the document.
     *
     * @returns The frame context.
     */
    const makeExtCssFrameContext = (extCssRules: string[]): FrameMV2 => {
        const frameContext = new FrameMV2({
            url: frameUrl,
            tabId,
            frameId,
            parentFrameId: -1,
            timeStamp: Date.now(),
        });
        frameContext.extCssData = { extCssRules, areHitsStatsCollected: false };

        return frameContext;
    };

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
        vi.useRealTimers();
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

    it('retries the context-less injection after a failure', async () => {
        vi.useFakeTimers();
        const rules = ['.ad:has(.child) { display: none !important; }'];
        vi.mocked(tabsApi.getFrameContext).mockReturnValue(undefined);
        vi.spyOn(CosmeticApi, 'getExtCssRules').mockReturnValue(rules);
        const injectSpy = vi.spyOn(TabsApi, 'injectScript')
            .mockRejectedValueOnce(new Error('Missing host permission'))
            .mockResolvedValueOnce();

        CosmeticApi.getContentScriptData(frameUrl, tabId, frameId);

        expect(injectSpy).toHaveBeenCalledTimes(1);

        await vi.advanceTimersByTimeAsync(10);

        expect(injectSpy).toHaveBeenCalledTimes(2);
    });

    it('applies the ExtendedCSS rules when the app is started', () => {
        const applyExtCssSpy = vi.spyOn(CosmeticApi, 'applyExtCss').mockResolvedValue(true);

        CosmeticApi.getContentScriptData(frameUrl, tabId, frameId);

        expect(applyExtCssSpy).toHaveBeenCalledWith(tabId, frameId);
    });

    it('does not apply the ExtendedCSS rules while the app is not started', () => {
        appContext.isAppStarted = false;
        const applyExtCssSpy = vi.spyOn(CosmeticApi, 'applyExtCss').mockResolvedValue(true);

        CosmeticApi.getContentScriptData(frameUrl, tabId, frameId);

        expect(applyExtCssSpy).not.toHaveBeenCalled();
    });

    it('does not inject the on-demand rules while the app is not started', () => {
        const rules = ['.ad:has(.child) { display: none !important; }'];
        appContext.isAppStarted = false;
        vi.mocked(tabsApi.getFrameContext).mockReturnValue(undefined);
        vi.spyOn(CosmeticApi, 'getExtCssRules').mockReturnValue(rules);
        const injectSpy = vi.spyOn(TabsApi, 'injectScript').mockResolvedValue();

        CosmeticApi.getContentScriptData(frameUrl, tabId, frameId);

        expect(injectSpy).not.toHaveBeenCalled();
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

    it('reports a failed ExtendedCSS apply to the content script', async () => {
        vi.useFakeTimers();
        const rules = ['.ad:has(.child) { display: none !important; }'];
        vi.mocked(tabsApi.getFrameContext).mockReturnValue(makeExtCssFrameContext(rules));
        vi.spyOn(CosmeticApi, 'getExtCssRules').mockReturnValue(rules);
        vi.spyOn(TabsApi, 'injectScript').mockRejectedValue(new Error('Missing host permission'));

        const injection = CosmeticApi.applyExtCss(tabId, frameId);
        await vi.runAllTimersAsync();
        await injection;

        // The response asks the content script for a reapply instead of
        // leaving the document without ExtendedCSS.
        const applySpy = vi.spyOn(CosmeticApi, 'applyExtCss').mockResolvedValue(true);
        const data = CosmeticApi.getContentScriptData(frameUrl, tabId, frameId);
        applySpy.mockRestore();

        expect(data.extCssMarkersState).toBe(ExtCssMarkersState.Failed);
    });

    it('reports an applied ExtendedCSS rule set to the content script', async () => {
        const rules = ['.ad:has(.child) { display: none !important; }'];
        vi.mocked(tabsApi.getFrameContext).mockReturnValue(makeExtCssFrameContext(rules));
        vi.spyOn(CosmeticApi, 'getExtCssRules').mockReturnValue(rules);
        vi.spyOn(TabsApi, 'injectScript').mockResolvedValue();

        await CosmeticApi.applyExtCss(tabId, frameId);

        const applySpy = vi.spyOn(CosmeticApi, 'applyExtCss').mockResolvedValue(true);
        const data = CosmeticApi.getContentScriptData(frameUrl, tabId, frameId);
        applySpy.mockRestore();

        expect(data.extCssMarkersState).toBe(ExtCssMarkersState.Applied);
    });
});
