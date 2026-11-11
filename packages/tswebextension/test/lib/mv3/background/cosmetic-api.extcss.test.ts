import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    type Mock,
    vi,
} from 'vitest';

// Installs the engine the way the background does: the prebuilt script asset
// goes into the document before the rule strings.
import '../../../../src/lib/common/extcss-engine';

import { extCssInjectedApply, extCssInjectedDispose } from '../../../../src/lib/common/extcss-apply-fn';
import { EXTCSS_PROTOCOL } from '../../../../src/lib/common/extcss-protocol';
import { logger } from '../../../../src/lib/common/utils/logger';
import { CosmeticApi } from '../../../../src/lib/mv3/background/cosmetic-api';
import { ScriptingApi } from '../../../../src/lib/mv3/background/scripting-api';
import { type FrameMV3, type PreparedCosmeticResultMV3 } from '../../../../src/lib/mv3/tabs/frame';
import { tabsApi } from '../../../../src/lib/mv3/tabs/tabs-api';

vi.mock('../../../../src/lib/mv3/tabs/tabs-api', () => ({
    tabsApi: {
        getFrameContext: vi.fn(),
    },
}));

vi.mock('../../../../src/lib/mv3/background/app-context', () => ({
    appContext: {
        configuration: {
            settings: {
                extCssScriptUrl: 'extcss-inject.js',
            },
        },
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

describe('CosmeticApi.applyCosmeticRules — ExtendedCss injection', () => {
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

    it('injects ExtendedCss via executeExtCss when rules exist', async () => {
        const rules = ['div:has(.ad) { display: none !important; }'];
        vi.mocked(tabsApi.getFrameContext).mockReturnValue(makeFrameContext(makePrepared(rules)));

        await CosmeticApi.applyCosmeticRules(1, 0, true);

        expect(ScriptingApi.executeExtCss).toHaveBeenCalledTimes(1);
        expect(ScriptingApi.executeExtCss).toHaveBeenCalledWith({
            tabId: 1,
            frameId: 0,
            cssRules: rules,
            collectStats: false,
            scriptUrl: 'extcss-inject.js',
        });
    });

    it('does not inject the rules when the engine script url is not configured', async () => {
        const rules = ['div:has(.ad) { display: none !important; }'];
        vi.mocked(tabsApi.getFrameContext).mockReturnValue(makeFrameContext(makePrepared(rules)));
        const { appContext } = await import('../../../../src/lib/mv3/background/app-context');
        const { configuration } = appContext;
        appContext.configuration = undefined;
        const errorSpy = vi.spyOn(logger, 'error');

        try {
            await CosmeticApi.applyCosmeticRules(1, 0, true);

            expect(ScriptingApi.executeExtCss).not.toHaveBeenCalled();
            expect(errorSpy).toHaveBeenCalledTimes(1);
        } finally {
            appContext.configuration = configuration;
        }
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
            scriptUrl: 'extcss-inject.js',
        });
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
            scriptUrl: 'extcss-inject.js',
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

    it('does not inject ExtendedCss on onResponseStarted (shouldApplyCss=false)', async () => {
        const rules = ['div:has(.ad) { display: none !important; }'];
        vi.mocked(tabsApi.getFrameContext).mockReturnValue(makeFrameContext(makePrepared(rules)));

        await CosmeticApi.applyCosmeticRules(1, 0, false);

        expect(ScriptingApi.executeExtCss).not.toHaveBeenCalled();
    });

    it('does not await the ExtendedCss injection (startup must not block on it)', async () => {
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

    it('logs scripting-path ExtendedCss failures at info level with no retry or fallback', async () => {
        const rules = ['div:has(.ad) { display: none !important; }'];
        vi.mocked(tabsApi.getFrameContext).mockReturnValue(makeFrameContext(makePrepared(rules)));
        const injectionError = new Error('Cannot access contents of the page');
        vi.mocked(ScriptingApi.executeExtCss).mockRejectedValue(injectionError);
        const infoSpy = vi.spyOn(logger, 'info');

        // Must not throw: applyExtCssRules catches internally and the ExtendedCss
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

    it('logs an engine guard failure returned by a resolved Chromium injection', async () => {
        const rules = ['div:has(.ad) { display: none !important; }'];
        vi.mocked(tabsApi.getFrameContext).mockReturnValue(makeFrameContext(makePrepared(rules)));
        vi.mocked(ScriptingApi.executeExtCss).mockRestore();
        const executeScript = vi.mocked(chrome.scripting.executeScript) as unknown as Mock;
        const message = 'ExtendedCss engine is not loaded';
        executeScript
            .mockReset()
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([{
                result: {
                    error: 'engine-not-loaded',
                    message,
                },
            }]);
        const infoSpy = vi.spyOn(logger, 'info');

        await CosmeticApi.applyCosmeticRules(1, 0, true);

        await vi.waitFor(() => {
            expect(infoSpy).toHaveBeenCalledTimes(1);
        });
        expect(infoSpy).toHaveBeenCalledWith(
            expect.stringContaining('[tsweb.CosmeticApi.applyExtCssRules]'),
            expect.objectContaining({ message }),
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

        // Drive the real `extCssInjectedApply` through the injection call
        // shape that `executeExtCss` would hand to
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

    it('disposes the instance when a recreated frame context gets an empty rule set', async () => {
        document.body.innerHTML = '<div class="ad">ad</div>';

        vi.spyOn(ScriptingApi, 'executeExtCss').mockImplementation(async (params) => {
            extCssInjectedApply(params.cssRules, params.collectStats, EXTCSS_PROTOCOL);
        });
        vi.spyOn(ScriptingApi, 'disposeExtCss').mockImplementation(async () => {
            extCssInjectedDispose(EXTCSS_PROTOCOL);
        });

        const rules = ['.ad { display: none !important; }'];
        vi.mocked(tabsApi.getFrameContext).mockReturnValue(makeFrameContext(
            makePrepared(rules),
            { documentId: 'document-1' },
        ));
        await CosmeticApi.applyCosmeticRules(1, 0, true);

        const ad = document.querySelector('.ad') as HTMLElement;
        expect(ad.style.getPropertyValue('display')).toBe('none');

        // A frame context recreated for the same document — a BFCache restore,
        // a prerender activation — holds no record of the injected instance,
        // while the document still does. The empty rule set must dispose it.
        vi.mocked(tabsApi.getFrameContext).mockReturnValue(makeFrameContext(
            makePrepared([]),
            { documentId: 'document-1' },
        ));
        await CosmeticApi.applyCosmeticRules(1, 0, true);

        expect(ad.style.getPropertyValue('display')).toBe('');
    });
});
