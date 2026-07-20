import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import { EXTCSS_PROTOCOL } from '../../../../src/lib/common/message-constants';
import { logger } from '../../../../src/lib/common/utils/logger';
import { CosmeticApi } from '../../../../src/lib/mv3/background/cosmetic-api';
import { applyExtCss } from '../../../../src/lib/mv3/background/extcss-apply-fn';
import { ScriptingApi } from '../../../../src/lib/mv3/background/scripting-api';
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
        vi.spyOn(ScriptingApi, 'disposeExtCss').mockResolvedValue();
        vi.spyOn(ScriptingApi, 'insertCSS').mockResolvedValue();
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

    it('injects disposeExtCss (not executeExtCss) when the rule set is empty', async () => {
        // Non-empty → empty transition on a same-document navigation: the
        // previously retained instance must be disposed so its observer and
        // styles do not leak.
        vi.mocked(tabsApi.getFrameContext).mockReturnValue({
            url: 'https://example.com/',
            preparedCosmeticResult: makePrepared([]),
        } as any);

        await CosmeticApi.applyCosmeticRules(1, 0, true);

        expect(ScriptingApi.executeExtCss).not.toHaveBeenCalled();
        expect(ScriptingApi.disposeExtCss).toHaveBeenCalledTimes(1);
        expect(ScriptingApi.disposeExtCss).toHaveBeenCalledWith({ tabId: 1, frameId: 0 });
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

    it('injects disposeExtCss (not executeExtCss) when extCssRules is null', async () => {
        vi.mocked(tabsApi.getFrameContext).mockReturnValue({
            url: 'https://example.com/',
            preparedCosmeticResult: makePrepared(null),
        } as any);

        await CosmeticApi.applyCosmeticRules(1, 0, true);

        expect(ScriptingApi.executeExtCss).not.toHaveBeenCalled();
        expect(ScriptingApi.disposeExtCss).toHaveBeenCalledTimes(1);
        expect(ScriptingApi.disposeExtCss).toHaveBeenCalledWith({ tabId: 1, frameId: 0 });
    });

    it('does not inject anything on onResponseStarted (shouldApplyCss=false), even for disposal', async () => {
        vi.mocked(tabsApi.getFrameContext).mockReturnValue({
            url: 'https://example.com/',
            preparedCosmeticResult: makePrepared(null),
        } as any);

        await CosmeticApi.applyCosmeticRules(1, 0, false);

        expect(ScriptingApi.executeExtCss).not.toHaveBeenCalled();
        expect(ScriptingApi.disposeExtCss).not.toHaveBeenCalled();
    });

    it('logs disposeExtCss failures at debug level without throwing', async () => {
        vi.mocked(tabsApi.getFrameContext).mockReturnValue({
            url: 'https://example.com/',
            preparedCosmeticResult: makePrepared(null),
        } as any);
        const disposalError = new Error('Cannot access contents of the page');
        vi.mocked(ScriptingApi.disposeExtCss).mockRejectedValue(disposalError);
        const debugSpy = vi.spyOn(logger, 'debug');

        // Must not throw: applyExtCssRules catches internally.
        await CosmeticApi.applyCosmeticRules(1, 0, true);

        expect(debugSpy).toHaveBeenCalledWith(
            expect.stringContaining('[tsweb.CosmeticApi.applyExtCssRules]'),
            disposalError,
        );
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
            applyExtCss(params.cssRules, params.collectStats, EXTCSS_PROTOCOL);
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
