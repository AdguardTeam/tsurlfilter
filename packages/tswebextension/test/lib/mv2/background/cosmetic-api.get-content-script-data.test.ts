import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import { EXTCSS_PROTOCOL, type ExtCssApplyResult } from '../../../../src/lib/common/extcss-protocol';
import { logger } from '../../../../src/lib/common/utils/logger';
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
                extCssScriptUrl: 'extcss-inject.js',
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

    it('injects the on-demand rules when the frame has no context', async () => {
        const rules = ['.ad:has(.child) { display: none !important; }'];
        vi.mocked(tabsApi.getFrameContext).mockReturnValue(undefined);
        vi.spyOn(CosmeticApi, 'getExtCssRules').mockReturnValue(rules);
        const fileSpy = vi.spyOn(TabsApi, 'injectScriptFile').mockResolvedValue();
        const injectSpy = vi.spyOn(TabsApi, 'injectScript').mockResolvedValue(undefined);

        CosmeticApi.getContentScriptData(frameUrl, tabId, frameId);

        // The engine asset is injected first, so the code string follows in a
        // microtask.
        await vi.waitFor(() => {
            expect(injectSpy).toHaveBeenCalledWith(
                tabId,
                frameId,
                serializeExtCssForCode(rules, false, EXTCSS_PROTOCOL),
            );
        });

        // The payload applies the rules through the engine that only this
        // asset installs.
        expect(fileSpy).toHaveBeenCalledTimes(1);
        expect(fileSpy).toHaveBeenCalledWith(tabId, frameId, 'extcss-inject.js');
        expect(fileSpy.mock.invocationCallOrder[0])
            .toBeLessThan(injectSpy.mock.invocationCallOrder[0]);
    });

    it('does not send the context-less rules when the frame gets a context meanwhile', async () => {
        vi.useFakeTimers();
        const rules = ['.ad:has(.child) { display: none !important; }'];
        vi.mocked(tabsApi.getFrameContext).mockReturnValue(undefined);
        vi.spyOn(CosmeticApi, 'getExtCssRules').mockReturnValue(rules);
        const injectSpy = vi.spyOn(TabsApi, 'injectScript').mockResolvedValue(undefined);

        // The frame commits a document of its own while the asset call is in
        // flight: its commit handler creates the context and applies the rules
        // of that document.
        vi.spyOn(TabsApi, 'injectScriptFile').mockImplementation(async () => {
            vi.mocked(tabsApi.getFrameContext).mockReturnValue({
                cosmeticResult: {},
            } as ReturnType<typeof tabsApi.getFrameContext>);
        });

        CosmeticApi.getContentScriptData(frameUrl, tabId, frameId);

        await vi.advanceTimersByTimeAsync(0);

        // The rule set belongs to the previous document, so it is not sent.
        expect(TabsApi.injectScriptFile).toHaveBeenCalledTimes(1);
        expect(injectSpy).not.toHaveBeenCalled();
    });

    it('logs a guard failure of the context-less injection as an error', async () => {
        vi.useFakeTimers();
        const rules = ['.ad:has(.child) { display: none !important; }'];
        vi.mocked(tabsApi.getFrameContext).mockReturnValue(undefined);
        vi.spyOn(CosmeticApi, 'getExtCssRules').mockReturnValue(rules);
        vi.spyOn(TabsApi, 'injectScriptFile').mockResolvedValue();
        const injectSpy = vi.spyOn(TabsApi, 'injectScript').mockResolvedValue({
            error: 'engine-not-loaded' as ExtCssApplyResult['error'],
            message: 'ExtendedCss engine is not loaded',
        });
        const errorSpy = vi.spyOn(logger, 'error');

        CosmeticApi.getContentScriptData(frameUrl, tabId, frameId);

        await vi.advanceTimersByTimeAsync(0);

        expect(errorSpy).toHaveBeenCalledWith(
            expect.stringContaining('engine-not-loaded'),
        );

        // A guard failure is terminal, so no retry is armed.
        await vi.advanceTimersByTimeAsync(10);

        expect(injectSpy).toHaveBeenCalledTimes(1);
    });

    it('retries the context-less injection after a failure', async () => {
        vi.useFakeTimers();
        const rules = ['.ad:has(.child) { display: none !important; }'];
        vi.mocked(tabsApi.getFrameContext).mockReturnValue(undefined);
        vi.spyOn(CosmeticApi, 'getExtCssRules').mockReturnValue(rules);
        const injectSpy = vi.spyOn(TabsApi, 'injectScript')
            .mockRejectedValueOnce(new Error('Missing host permission'))
            .mockResolvedValueOnce(undefined);

        CosmeticApi.getContentScriptData(frameUrl, tabId, frameId);

        // Let the engine asset call and the first code-string call settle.
        await vi.advanceTimersByTimeAsync(0);

        expect(injectSpy).toHaveBeenCalledTimes(1);

        await vi.advanceTimersByTimeAsync(10);

        expect(injectSpy).toHaveBeenCalledTimes(2);
    });

    it('applies the ExtendedCSS rules when the app is started', () => {
        const applyExtCssSpy = vi.spyOn(CosmeticApi, 'applyExtCss').mockResolvedValue();

        CosmeticApi.getContentScriptData(frameUrl, tabId, frameId);

        expect(applyExtCssSpy).toHaveBeenCalledWith(tabId, frameId);
    });

    it('does not apply the ExtendedCSS rules while the app is not started', () => {
        appContext.isAppStarted = false;
        const applyExtCssSpy = vi.spyOn(CosmeticApi, 'applyExtCss').mockResolvedValue();

        CosmeticApi.getContentScriptData(frameUrl, tabId, frameId);

        expect(applyExtCssSpy).not.toHaveBeenCalled();
    });

    it('does not inject the on-demand rules while the app is not started', () => {
        const rules = ['.ad:has(.child) { display: none !important; }'];
        appContext.isAppStarted = false;
        vi.mocked(tabsApi.getFrameContext).mockReturnValue(undefined);
        vi.spyOn(CosmeticApi, 'getExtCssRules').mockReturnValue(rules);
        const injectSpy = vi.spyOn(TabsApi, 'injectScript').mockResolvedValue(undefined);

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
});
