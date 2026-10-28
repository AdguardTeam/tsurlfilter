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
import { extCssInjectedApply } from '../../../../src/lib/mv3/background/extcss-apply-fn';
import { ScriptingApi } from '../../../../src/lib/mv3/background/scripting-api';
import { type FrameMV3, type PreparedCosmeticResultMV3 } from '../../../../src/lib/mv3/tabs/frame';
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

const makeFrameContext = (
    preparedCosmeticResult: PreparedCosmeticResultMV3,
    overrides: Partial<FrameMV3> = {},
): FrameMV3 => ({
    url: 'https://example.com/',
    tabId: 1,
    frameId: 0,
    preparedCosmeticResult,
    ...overrides,
} as FrameMV3);

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
        vi.mocked(tabsApi.getFrameContext).mockReturnValue(makeFrameContext(makePrepared(rules)));

        await CosmeticApi.applyCosmeticRules(1, 0, true);

        expect(ScriptingApi.executeExtCss).toHaveBeenCalledTimes(1);
        expect(ScriptingApi.executeExtCss).toHaveBeenCalledWith({
            tabId: 1,
            frameId: 0,
            cssRules: rules,
            collectStats: false,
        });
    });

    it('forwards areHitsStatsCollected from the prepared result to executeExtCss', async () => {
        const rules = ['div:has(.ad) { display: none !important; }'];
        vi.mocked(tabsApi.getFrameContext).mockReturnValue(makeFrameContext(
            { ...makePrepared(rules), areHitsStatsCollected: true },
        ));

        await CosmeticApi.applyCosmeticRules(1, 0, true);

        expect(ScriptingApi.executeExtCss).toHaveBeenCalledWith({
            tabId: 1,
            frameId: 0,
            cssRules: rules,
            collectStats: true,
        });
    });

    it('disposes instead of injecting when the rule set is empty', async () => {
        vi.mocked(tabsApi.getFrameContext).mockReturnValue(makeFrameContext(makePrepared([])));

        await CosmeticApi.applyCosmeticRules(1, 0, true);

        expect(ScriptingApi.executeExtCss).not.toHaveBeenCalled();
        expect(ScriptingApi.disposeExtCss).toHaveBeenCalledTimes(1);
    });

    it('disposes instead of injecting when extCssRules is null', async () => {
        vi.mocked(tabsApi.getFrameContext).mockReturnValue(makeFrameContext(makePrepared(null)));

        await CosmeticApi.applyCosmeticRules(1, 0, true);

        expect(ScriptingApi.executeExtCss).not.toHaveBeenCalled();
        expect(ScriptingApi.disposeExtCss).toHaveBeenCalledTimes(1);
    });

    it('binds the injection to the frame context document', async () => {
        const rules = ['div:has(.ad) { display: none !important; }'];
        vi.mocked(tabsApi.getFrameContext).mockReturnValue(makeFrameContext(
            makePrepared(rules),
            { documentId: 'document-1' },
        ));

        await CosmeticApi.applyCosmeticRules(1, 0, true);

        expect(ScriptingApi.executeExtCss).toHaveBeenCalledWith({
            tabId: 1,
            frameId: 0,
            documentId: 'document-1',
            cssRules: rules,
            collectStats: false,
        });
    });

    it('disposes the retained instance when the rule set becomes empty', async () => {
        const frameContext = makeFrameContext(
            makePrepared([]),
            { documentId: 'document-1' },
        );
        vi.mocked(tabsApi.getFrameContext).mockReturnValue(frameContext);

        await CosmeticApi.applyCosmeticRules(1, 0, true);

        expect(ScriptingApi.executeExtCss).not.toHaveBeenCalled();
        expect(ScriptingApi.disposeExtCss).toHaveBeenCalledWith({
            tabId: 1,
            frameId: 0,
            documentId: 'document-1',
        });
    });

    it('does not inject ExtCSS on onResponseStarted (shouldApplyCss=false)', async () => {
        const rules = ['div:has(.ad) { display: none !important; }'];
        vi.mocked(tabsApi.getFrameContext).mockReturnValue(makeFrameContext(makePrepared(rules)));

        await CosmeticApi.applyCosmeticRules(1, 0, false);

        expect(ScriptingApi.executeExtCss).not.toHaveBeenCalled();
    });

    it('does not await the ExtCSS injection (startup must not block on it)', async () => {
        const rules = ['div:has(.ad) { display: none !important; }'];
        vi.mocked(tabsApi.getFrameContext).mockReturnValue(makeFrameContext(makePrepared(rules)));

        // Never settle, like a slow executeScript in a busy open tab: awaiting
        // it used to delay `processOpenTabs` and therefore `isAppStarted`.
        let resolveInjection: () => void = () => {};
        vi.mocked(ScriptingApi.executeExtCss).mockImplementation(() => new Promise<void>((resolve) => {
            resolveInjection = resolve;
        }));

        await expect(CosmeticApi.applyCosmeticRules(1, 0, true)).resolves.toEqual(expect.any(Array));

        // Release the pending injection so it cannot outlive the test.
        resolveInjection();
    });

    it('logs scripting-path ExtCSS failures at info level with no retry or fallback', async () => {
        const rules = ['div:has(.ad) { display: none !important; }'];
        vi.mocked(tabsApi.getFrameContext).mockReturnValue(makeFrameContext(makePrepared(rules)));
        const injectionError = new Error('Cannot access contents of the page');
        vi.mocked(ScriptingApi.executeExtCss).mockRejectedValue(injectionError);
        const infoSpy = vi.spyOn(logger, 'info');

        // Must not throw: applyExtCssRules catches internally and the ExtCSS
        // task is not awaited, so no unhandled rejection reaches the worker.
        const result = await CosmeticApi.applyCosmeticRules(1, 0, true);

        // Single attempt — no retry loop.
        expect(ScriptingApi.executeExtCss).toHaveBeenCalledTimes(1);
        expect(result).toEqual(expect.any(Array));

        // Logged once at info level — the same level as the other injection
        // failures in this class — with the context-tagged message and the error.
        const expectedMessage = '[tsweb.CosmeticApi.applyExtCssRules]:'
            + ' error occurred during injection into tabId 1 and frameId 0 ';
        await vi.waitFor(() => {
            expect(infoSpy).toHaveBeenCalledTimes(1);
        });
        expect(infoSpy).toHaveBeenCalledWith(
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

        // Drive the real inlined `extCssInjectedApply` through the injection
        // call shape that `executeExtCss` would hand to
        // `chrome.scripting.executeScript`.
        vi.spyOn(ScriptingApi, 'executeExtCss').mockImplementation(async (params) => {
            extCssInjectedApply(params.cssRules, params.collectStats, EXTCSS_PROTOCOL);
        });

        const rules = ['.ad:has(.child) { display: none !important; }'];
        vi.mocked(tabsApi.getFrameContext).mockReturnValue(makeFrameContext(makePrepared(rules)));

        await CosmeticApi.applyCosmeticRules(1, 0, true);

        const ad = document.querySelector('.ad') as HTMLElement;
        expect(ad.style.getPropertyValue('display')).toBe('none');
        expect(ad.style.getPropertyPriority('display')).toBe('important');
    });
});
