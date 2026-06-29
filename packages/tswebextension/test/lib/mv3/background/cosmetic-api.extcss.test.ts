import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import { logger } from '../../../../src/lib/common/utils/logger';
import { CosmeticApi } from '../../../../src/lib/mv3/background/cosmetic-api';
import { applyExtCss } from '../../../../src/lib/mv3/background/extcss-apply-fn';
import { ScriptingApi } from '../../../../src/lib/mv3/background/scripting-api';
import { UserScriptsApi } from '../../../../src/lib/mv3/background/user-scripts-api';
import { type PreparedCosmeticResultMV3 } from '../../../../src/lib/mv3/tabs/frame';
import { tabsApi } from '../../../../src/lib/mv3/tabs/tabs-api';

vi.mock('../../../../src/lib/mv3/tabs/tabs-api', () => ({
    tabsApi: {
        getFrameContext: vi.fn(),
    },
}));

const makePrepared = (extCssRules: string[] | null): PreparedCosmeticResultMV3 => ({
    cssText: '',
    extCssRules,
    areHitsStatsCollected: false,
    localRules: {
        scriptTexts: [],
        scriptletDataList: [],
        rawRules: [],
    },
    remoteRules: {
        scriptText: '',
        rawRules: [],
    },
});

describe('CosmeticApi.applyCosmeticRules — ExtCSS injection', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        vi.mocked(tabsApi.getFrameContext).mockReset();
        vi.spyOn(ScriptingApi, 'executeExtCss').mockResolvedValue();
        vi.spyOn(ScriptingApi, 'insertCSS').mockResolvedValue();
        vi.spyOn(UserScriptsApi, 'executeExtCss').mockResolvedValue();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('injects ExtCSS via executeExtCss when rules exist', async () => {
        const rules = ['div:has(.ad) { display: none !important; }'];
        vi.mocked(tabsApi.getFrameContext).mockReturnValue({
            url: 'https://example.com/',
            preparedCosmeticResult: makePrepared(rules),
        } as any);

        await CosmeticApi.applyCosmeticRules(1, 0, true);

        expect(ScriptingApi.executeExtCss).toHaveBeenCalledTimes(1);
        expect(ScriptingApi.executeExtCss).toHaveBeenCalledWith({
            tabId: 1,
            frameId: 0,
            cssRules: rules,
            collectStats: false,
        });
    });

    it('makes NO executeExtCss call when the rule set is empty', async () => {
        vi.mocked(tabsApi.getFrameContext).mockReturnValue({
            url: 'https://example.com/',
            preparedCosmeticResult: makePrepared([]),
        } as any);

        await CosmeticApi.applyCosmeticRules(1, 0, true);

        expect(ScriptingApi.executeExtCss).not.toHaveBeenCalled();
    });

    it('forwards areHitsStatsCollected from the prepared result to executeExtCss', async () => {
        const rules = ['div:has(.ad) { display: none !important; }'];
        vi.mocked(tabsApi.getFrameContext).mockReturnValue({
            url: 'https://example.com/',
            preparedCosmeticResult: { ...makePrepared(rules), areHitsStatsCollected: true },
        } as any);

        await CosmeticApi.applyCosmeticRules(1, 0, true);

        expect(ScriptingApi.executeExtCss).toHaveBeenCalledWith({
            tabId: 1,
            frameId: 0,
            cssRules: rules,
            collectStats: true,
        });
    });

    it('makes NO executeExtCss call when extCssRules is null', async () => {
        vi.mocked(tabsApi.getFrameContext).mockReturnValue({
            url: 'https://example.com/',
            preparedCosmeticResult: makePrepared(null),
        } as any);

        await CosmeticApi.applyCosmeticRules(1, 0, true);

        expect(ScriptingApi.executeExtCss).not.toHaveBeenCalled();
    });

    it('does not inject ExtCSS on onResponseStarted (shouldApplyCss=false)', async () => {
        const rules = ['div:has(.ad) { display: none !important; }'];
        vi.mocked(tabsApi.getFrameContext).mockReturnValue({
            url: 'https://example.com/',
            preparedCosmeticResult: makePrepared(rules),
        } as any);

        await CosmeticApi.applyCosmeticRules(1, 0, false);

        expect(ScriptingApi.executeExtCss).not.toHaveBeenCalled();
    });

    it('logs scripting-path ExtCSS failures at debug level with no retry or fallback', async () => {
        const rules = ['div:has(.ad) { display: none !important; }'];
        vi.mocked(tabsApi.getFrameContext).mockReturnValue({
            url: 'https://example.com/',
            preparedCosmeticResult: makePrepared(rules),
        } as any);
        const injectionError = new Error('Cannot access contents of the page');
        vi.mocked(ScriptingApi.executeExtCss).mockRejectedValue(injectionError);
        const debugSpy = vi.spyOn(logger, 'debug');

        // Must not throw: applyExtCssRules catches internally and applyCosmeticRules
        // uses Promise.allSettled, so no unhandled rejection reaches the worker.
        const result = await CosmeticApi.applyCosmeticRules(1, 0, true);

        // Single attempt — no retry loop.
        expect(ScriptingApi.executeExtCss).toHaveBeenCalledTimes(1);
        // No fallback activation: the userScripts path is never tried.
        expect(UserScriptsApi.executeExtCss).not.toHaveBeenCalled();
        expect(result).toEqual(expect.any(Array));

        // Logged once at debug level with the context-tagged message and the error.
        const expectedMessage = '[tsweb.CosmeticApi.applyExtCssRules]:'
            + ' error occurred during injection into tabId 1 and frameId 0 ';
        expect(debugSpy).toHaveBeenCalledTimes(1);
        expect(debugSpy).toHaveBeenCalledWith(
            expect.stringContaining(expectedMessage),
            injectionError,
        );
    });

    it('routes ExtCSS via UserScriptsApi.executeExtCss when userScripts is enabled', async () => {
        const rules = ['div:has(.ad) { display: none !important; }'];
        vi.mocked(tabsApi.getFrameContext).mockReturnValue({
            url: 'https://example.com/',
            preparedCosmeticResult: makePrepared(rules),
        } as any);
        vi.spyOn(UserScriptsApi, 'isEnabled', 'get').mockReturnValue(true);

        await CosmeticApi.applyCosmeticRules(1, 0, true);

        expect(UserScriptsApi.executeExtCss).toHaveBeenCalledTimes(1);
        expect(UserScriptsApi.executeExtCss).toHaveBeenCalledWith({
            tabId: 1,
            frameId: 0,
            cssRules: rules,
            collectStats: false,
        });
        expect(ScriptingApi.executeExtCss).not.toHaveBeenCalled();
    });

    it('routes ExtCSS via ScriptingApi.executeExtCss when userScripts is disabled', async () => {
        const rules = ['div:has(.ad) { display: none !important; }'];
        vi.mocked(tabsApi.getFrameContext).mockReturnValue({
            url: 'https://example.com/',
            preparedCosmeticResult: makePrepared(rules),
        } as any);
        vi.spyOn(UserScriptsApi, 'isEnabled', 'get').mockReturnValue(false);

        await CosmeticApi.applyCosmeticRules(1, 0, true);

        expect(UserScriptsApi.executeExtCss).not.toHaveBeenCalled();
        expect(ScriptingApi.executeExtCss).toHaveBeenCalledTimes(1);
        expect(ScriptingApi.executeExtCss).toHaveBeenCalledWith({
            tabId: 1,
            frameId: 0,
            cssRules: rules,
            collectStats: false,
        });
    });
});

describe('CosmeticApi.applyCosmeticRules — end-to-end in jsdom', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        vi.mocked(tabsApi.getFrameContext).mockReset();
        vi.spyOn(ScriptingApi, 'insertCSS').mockResolvedValue();
        document.body.innerHTML = '';
    });

    afterEach(() => {
        vi.restoreAllMocks();
        document.body.innerHTML = '';
    });

    it('the injected func hides a matching :has() element when executed', async () => {
        document.body.innerHTML = '<div class="ad"><span class="child">ad</span></div>';

        // Drive the real inlined `applyExtCss` through the injection call shape
        // that `executeExtCss` would hand to `chrome.scripting.executeScript`.
        vi.spyOn(ScriptingApi, 'executeExtCss').mockImplementation(async (params) => {
            applyExtCss(params.cssRules);
        });

        const rules = ['.ad:has(.child) { display: none !important; }'];
        vi.mocked(tabsApi.getFrameContext).mockReturnValue({
            url: 'https://example.com/',
            preparedCosmeticResult: makePrepared(rules),
        } as any);

        await CosmeticApi.applyCosmeticRules(1, 0, true);

        const ad = document.querySelector('.ad') as HTMLElement;
        expect(ad.style.getPropertyValue('display')).toBe('none');
        expect(ad.style.getPropertyPriority('display')).toBe('important');
    });
});
