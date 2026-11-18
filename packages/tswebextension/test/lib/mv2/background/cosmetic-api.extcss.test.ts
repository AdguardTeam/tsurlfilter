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
import { CosmeticApi } from '../../../../src/lib/mv2/background/cosmetic-api';
import { serializeExtCssDisposeForCode, serializeExtCssForCode } from '../../../../src/lib/mv2/background/extcss-code';
import { FrameMV2, type PreparedCosmeticResultMV2 } from '../../../../src/lib/mv2/background/tabs/frame';
import { TabsApi } from '../../../../src/lib/mv2/background/tabs/tabs-api';

vi.mock('../../../../src/lib/mv2/background/api', () => ({
    engineApi: {},
    tabsApi: {
        getFrameContext: vi.fn(),
    },
}));

vi.mock('../../../../src/lib/mv2/background/app-context', () => ({
    appContext: {
        configuration: {
            settings: {
                extCssScriptUrl: 'extcss-inject.js',
            },
        },
    },
}));

vi.mock('../../../../src/lib/mv2/background/services/local-script-rules-service', () => ({
    localScriptRulesService: {},
}));

/**
 * Creates a prepared cosmetic result with the given ExtCSS rules.
 *
 * @param extCssRules ExtCSS rules, or null when none match.
 * @param areHitsStatsCollected Whether hits statistics are collected.
 *
 * @returns The prepared cosmetic result.
 */
const makePrepared = (
    extCssRules: string[] | null,
    areHitsStatsCollected = false,
): PreparedCosmeticResultMV2 => ({
    scriptText: '',
    extCssRules,
    areHitsStatsCollected,
});

/**
 * Creates a frame context with the given prepared result.
 *
 * @param preparedCosmeticResult Prepared cosmetic result, if any.
 * @param isApplied Whether the prepared rule set is already applied to the document.
 * @param mayHoldInstance Whether the context may hold an instance it did not apply.
 *
 * @returns The frame context.
 */
const makeFrameContext = (
    preparedCosmeticResult?: PreparedCosmeticResultMV2,
    isApplied = false,
    mayHoldInstance = false,
): FrameMV2 => {
    const frameContext = new FrameMV2({
        url: 'https://example.com/',
        tabId: 1,
        frameId: 0,
        parentFrameId: -1,
        timeStamp: Date.now(),
    });
    frameContext.preparedCosmeticResult = preparedCosmeticResult;
    frameContext.extCssInstanceMayExist = mayHoldInstance;
    if (isApplied) {
        frameContext.extCssAppliedData = preparedCosmeticResult?.extCssRules ?? [];
    }
    return frameContext;
};

/**
 * Lets the queued ExtendedCSS operations reach the browser.
 *
 * An operation starts after the previous one of the document settles, so it
 * calls the browser one microtask after the caller.
 */
const flushOperations = async (): Promise<void> => {
    await Promise.resolve();
    await Promise.resolve();
};

describe('CosmeticApi.applyExtCss', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        vi.mocked(tabsApi.getFrameContext).mockReset();
        vi.spyOn(TabsApi, 'injectScript').mockResolvedValue(true);
        vi.spyOn(TabsApi, 'injectScriptFile').mockResolvedValue();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('injects the serialized apply code when rules exist', async () => {
        const rules = ['.ad:has(.child) { display: none !important; }'];
        vi.mocked(tabsApi.getFrameContext).mockReturnValue(makeFrameContext(makePrepared(rules)));

        await CosmeticApi.applyExtCss(1, 0);

        expect(TabsApi.injectScript).toHaveBeenCalledTimes(1);
        expect(TabsApi.injectScript).toHaveBeenCalledWith(
            1,
            0,
            serializeExtCssForCode(rules, false, EXTCSS_PROTOCOL),
        );
    });

    it('injects the prebuilt engine script before the serialized apply code', async () => {
        const rules = ['.ad:has(.child) { display: none !important; }'];
        vi.mocked(tabsApi.getFrameContext).mockReturnValue(makeFrameContext(makePrepared(rules)));

        await CosmeticApi.applyExtCss(1, 0);

        expect(TabsApi.injectScriptFile).toHaveBeenCalledTimes(1);
        expect(TabsApi.injectScriptFile).toHaveBeenCalledWith(1, 0, 'extcss-inject.js');
        // The engine has to be installed before the rules are applied.
        expect(vi.mocked(TabsApi.injectScriptFile).mock.invocationCallOrder[0])
            .toBeLessThan(vi.mocked(TabsApi.injectScript).mock.invocationCallOrder[0]);
    });

    it('does not inject the engine script when disposing', async () => {
        vi.mocked(tabsApi.getFrameContext)
            .mockReturnValue(makeFrameContext(makePrepared(null)));

        await CosmeticApi.applyExtCss(1, 0);

        expect(TabsApi.injectScriptFile).not.toHaveBeenCalled();
    });

    it('does not inject the rules when the engine script url is not configured', async () => {
        const rules = ['.ad:has(.child) { display: none !important; }'];
        vi.mocked(tabsApi.getFrameContext).mockReturnValue(makeFrameContext(makePrepared(rules)));
        const { configuration } = appContext;
        appContext.configuration = undefined;
        const errorSpy = vi.spyOn(logger, 'error');

        try {
            await CosmeticApi.applyExtCss(1, 0);

            expect(TabsApi.injectScriptFile).not.toHaveBeenCalled();
            expect(TabsApi.injectScript).not.toHaveBeenCalled();
            expect(errorSpy).toHaveBeenCalledTimes(1);
        } finally {
            appContext.configuration = configuration;
        }
    });

    it('forwards areHitsStatsCollected to the serializer', async () => {
        const rules = ['.ad:has(.child) { display: none !important; }'];
        vi.mocked(tabsApi.getFrameContext)
            .mockReturnValue(makeFrameContext(makePrepared(rules, true)));

        await CosmeticApi.applyExtCss(1, 0);

        expect(TabsApi.injectScript).toHaveBeenCalledWith(
            1,
            0,
            serializeExtCssForCode(rules, true, EXTCSS_PROTOCOL),
        );
    });

    it('injects the serialized dispose code when rules are empty', async () => {
        vi.mocked(tabsApi.getFrameContext)
            .mockReturnValue(makeFrameContext(makePrepared([]), false, true));

        await CosmeticApi.applyExtCss(1, 0);

        expect(TabsApi.injectScript).toHaveBeenCalledTimes(1);
        expect(TabsApi.injectScript).toHaveBeenCalledWith(
            1,
            0,
            serializeExtCssDisposeForCode(EXTCSS_PROTOCOL),
        );
    });

    it('injects the serialized dispose code when rules are null', async () => {
        vi.mocked(tabsApi.getFrameContext)
            .mockReturnValue(makeFrameContext(makePrepared(null), false, true));

        await CosmeticApi.applyExtCss(1, 0);

        expect(TabsApi.injectScript).toHaveBeenCalledTimes(1);
        expect(TabsApi.injectScript).toHaveBeenCalledWith(
            1,
            0,
            serializeExtCssDisposeForCode(EXTCSS_PROTOCOL),
        );
    });

    it('does not dispose for a context that cannot hold an instance', async () => {
        vi.mocked(tabsApi.getFrameContext)
            .mockReturnValue(makeFrameContext(makePrepared([])));

        await CosmeticApi.applyExtCss(1, 0);

        expect(TabsApi.injectScript).not.toHaveBeenCalled();
    });

    it('disposes once per document for a context that may hold an instance', async () => {
        const frameContext = makeFrameContext(makePrepared([]), false, true);
        vi.mocked(tabsApi.getFrameContext).mockReturnValue(frameContext);

        await CosmeticApi.applyExtCss(1, 0);
        await CosmeticApi.applyExtCss(1, 0);

        expect(TabsApi.injectScript).toHaveBeenCalledTimes(1);
        expect(frameContext.extCssDisposedDocumentVersion).toBe(0);
    });

    it('disposes again for the next document', async () => {
        const frameContext = makeFrameContext(makePrepared([]), false, true);
        vi.mocked(tabsApi.getFrameContext).mockReturnValue(frameContext);

        await CosmeticApi.applyExtCss(1, 0);

        frameContext.extCssDocumentVersion += 1;
        await CosmeticApi.applyExtCss(1, 0);

        expect(TabsApi.injectScript).toHaveBeenCalledTimes(2);
    });

    it('disposes again after a rule set is applied later in the same document', async () => {
        const rules = ['.ad:has(.child) { display: none !important; }'];
        const frameContext = makeFrameContext(makePrepared([]), false, true);
        vi.mocked(tabsApi.getFrameContext).mockReturnValue(frameContext);

        await CosmeticApi.applyExtCss(1, 0);

        frameContext.preparedCosmeticResult = makePrepared(rules);
        await CosmeticApi.applyExtCss(1, 0);

        frameContext.preparedCosmeticResult = makePrepared([]);
        await CosmeticApi.applyExtCss(1, 0);

        expect(TabsApi.injectScript).toHaveBeenCalledTimes(3);
    });

    it('disposes for a document whose instance this context applied', async () => {
        const rules = ['.ad:has(.child) { display: none !important; }'];
        const frameContext = makeFrameContext(makePrepared(rules));
        vi.mocked(tabsApi.getFrameContext).mockReturnValue(frameContext);

        await CosmeticApi.applyExtCss(1, 0);

        frameContext.preparedCosmeticResult = makePrepared([]);
        await CosmeticApi.applyExtCss(1, 0);

        expect(TabsApi.injectScript).toHaveBeenCalledTimes(2);
        expect(TabsApi.injectScript).toHaveBeenLastCalledWith(
            1,
            0,
            serializeExtCssDisposeForCode(EXTCSS_PROTOCOL),
        );
    });

    it('does not inject into a context that awaits its commit', async () => {
        const frameContext = makeFrameContext(
            makePrepared(['.ad:has(.child) { display: none !important; }']),
        );
        frameContext.extCssAwaitingCommit = true;
        vi.mocked(tabsApi.getFrameContext).mockReturnValue(frameContext);

        await CosmeticApi.applyExtCss(1, 0);

        expect(TabsApi.injectScript).not.toHaveBeenCalled();
    });

    it('does not inject when the frame context is missing', async () => {
        vi.mocked(tabsApi.getFrameContext).mockReturnValue(undefined);

        await CosmeticApi.applyExtCss(1, 0);

        expect(TabsApi.injectScript).not.toHaveBeenCalled();
    });

    it('does not inject when the frame has no cosmetic data', async () => {
        vi.mocked(tabsApi.getFrameContext).mockReturnValue(makeFrameContext());

        await CosmeticApi.applyExtCss(1, 0);

        expect(TabsApi.injectScript).not.toHaveBeenCalled();
    });

    it('uses the ExtCSS data kept on the frame context', async () => {
        const rules = ['.ad:has(.child) { display: none !important; }'];
        const frameContext = makeFrameContext();
        frameContext.cosmeticResult = {} as FrameMV2['cosmeticResult'];
        frameContext.extCssData = { extCssRules: rules, areHitsStatsCollected: true };
        vi.mocked(tabsApi.getFrameContext).mockReturnValue(frameContext);
        const getExtCssRulesSpy = vi.spyOn(CosmeticApi, 'getExtCssRules');

        await CosmeticApi.applyExtCss(1, 0);

        expect(getExtCssRulesSpy).not.toHaveBeenCalled();
        expect(TabsApi.injectScript).toHaveBeenCalledWith(
            1,
            0,
            serializeExtCssForCode(rules, true, EXTCSS_PROTOCOL),
        );
    });

    it('skips the injection when the rules were already applied', async () => {
        const rules = ['.ad:has(.child) { display: none !important; }'];
        vi.mocked(tabsApi.getFrameContext)
            .mockReturnValue(makeFrameContext(makePrepared(rules), true));

        await CosmeticApi.applyExtCss(1, 0);

        expect(TabsApi.injectScript).not.toHaveBeenCalled();
    });

    it('does not inject into a frame context that was replaced before the payload runs', async () => {
        const rules = ['.ad:has(.child) { display: none !important; }'];
        const original = makeFrameContext(makePrepared(rules));
        const replacement = makeFrameContext(makePrepared(rules));

        vi.mocked(tabsApi.getFrameContext)
            .mockReturnValueOnce(original)
            .mockReturnValue(replacement);

        const isApplied = await CosmeticApi.applyExtCss(1, 0);

        expect(isApplied).toBe(false);
        expect(TabsApi.injectScript).not.toHaveBeenCalled();
        expect(original.extCssAppliedData).toBeUndefined();
        expect(replacement.extCssAppliedData).toBeUndefined();
    });

    it('does not run a queued payload when the frame context was replaced', async () => {
        const rules = ['.ad:has(.child) { display: none !important; }'];
        const markedRules = [
            ".ad:has(.child) { display: none !important; content: 'adguard0%3B1' !important; }",
        ];
        const original = makeFrameContext(makePrepared(rules));
        const replacement = makeFrameContext(makePrepared(rules));
        vi.mocked(tabsApi.getFrameContext).mockReturnValue(original);

        let resolveFirst!: (result: boolean) => void;
        vi.mocked(TabsApi.injectScript).mockImplementationOnce(() => new Promise<boolean>((resolve) => {
            resolveFirst = resolve;
        }));

        const first = CosmeticApi.applyExtCss(1, 0);
        await flushOperations();

        const second = CosmeticApi.applyExtCss(1, 0, {
            extCssData: { extCssRules: markedRules, areHitsStatsCollected: true },
            force: true,
        });
        await flushOperations();

        expect(TabsApi.injectScriptFile).toHaveBeenCalledTimes(1);
        expect(TabsApi.injectScript).toHaveBeenCalledTimes(1);

        // The frame context is replaced while the first payload's code
        // injection is in flight.
        vi.mocked(tabsApi.getFrameContext).mockReturnValue(replacement);
        resolveFirst(true);

        await first;
        const isSecondApplied = await second;

        // The queued payload belongs to the dismissed context, so it never
        // reaches the browser and no state is written.
        expect(TabsApi.injectScriptFile).toHaveBeenCalledTimes(1);
        expect(TabsApi.injectScript).toHaveBeenCalledTimes(1);
        expect(isSecondApplied).toBe(false);
        expect(original.extCssAppliedData).toBeUndefined();
        expect(replacement.extCssAppliedData).toBeUndefined();
    });

    it('does not inject the code when the document changed while the asset was injected', async () => {
        const rules = ['.ad:has(.child) { display: none !important; }'];
        const frameContext = makeFrameContext(makePrepared(rules));
        vi.mocked(tabsApi.getFrameContext).mockReturnValue(frameContext);

        let resolveAsset!: () => void;
        vi.mocked(TabsApi.injectScriptFile).mockImplementation(() => new Promise<void>((resolve) => {
            resolveAsset = resolve;
        }));

        const injection = CosmeticApi.applyExtCss(1, 0);

        await vi.waitFor(() => {
            expect(TabsApi.injectScriptFile).toHaveBeenCalledTimes(1);
        });

        // A same-URL commit keeps the context and bumps the document version.
        frameContext.extCssDocumentVersion += 1;

        resolveAsset();
        await injection;

        // The too-late code string would have replaced the new document's
        // rules, so it is not injected at all.
        expect(TabsApi.injectScript).not.toHaveBeenCalled();
        expect(frameContext.extCssAppliedData).toBeUndefined();
    });

    it('does not mark a document that was committed during the injection', async () => {
        const rules = ['.ad:has(.child) { display: none !important; }'];
        const frameContext = makeFrameContext(makePrepared(rules));
        vi.mocked(tabsApi.getFrameContext).mockReturnValue(frameContext);

        let resolveInjection!: (result: boolean) => void;
        vi.mocked(TabsApi.injectScript).mockImplementation(() => new Promise<boolean>((resolve) => {
            resolveInjection = resolve;
        }));

        const injection = CosmeticApi.applyExtCss(1, 0);

        // The engine asset is injected before the code string, so the code
        // call happens in a microtask and the injection is still in flight.
        await vi.waitFor(() => {
            expect(TabsApi.injectScript).toHaveBeenCalledTimes(1);
        });

        // A same-URL commit keeps the context and bumps the document version.
        frameContext.extCssDocumentVersion += 1;
        frameContext.extCssAppliedData = undefined;

        resolveInjection(true);
        await injection;

        expect(frameContext.extCssAppliedData).toBeUndefined();
    });

    it('does not inject again while an injection is in flight', async () => {
        const rules = ['.ad:has(.child) { display: none !important; }'];
        const frameContext = makeFrameContext(makePrepared(rules));
        vi.mocked(tabsApi.getFrameContext).mockReturnValue(frameContext);

        let resolveInjection!: (result: boolean) => void;
        vi.mocked(TabsApi.injectScript).mockImplementation(() => new Promise<boolean>((resolve) => {
            resolveInjection = resolve;
        }));

        const injection = CosmeticApi.applyExtCss(1, 0);
        await CosmeticApi.applyExtCss(1, 0);
        await flushOperations();

        expect(TabsApi.injectScript).toHaveBeenCalledTimes(1);

        resolveInjection(true);
        await injection;

        expect(frameContext.extCssAppliedData).toEqual(rules);
    });

    it('records the applied rule set after a successful apply', async () => {
        const rules = ['.ad:has(.child) { display: none !important; }'];
        const frameContext = makeFrameContext(makePrepared(rules));
        vi.mocked(tabsApi.getFrameContext).mockReturnValue(frameContext);

        // The apply code returns the success sentinel.
        vi.mocked(TabsApi.injectScript).mockResolvedValue(true);

        const isApplied = await CosmeticApi.applyExtCss(1, 0);

        expect(isApplied).toBe(true);
        expect(frameContext.extCssAppliedData).toEqual(rules);
    });

    it('does not record the applied rule set when the code resolves without the success sentinel', async () => {
        vi.useFakeTimers();

        try {
            const rules = ['.ad:has(.child) { display: none !important; }'];
            const frameContext = makeFrameContext(makePrepared(rules));
            vi.mocked(tabsApi.getFrameContext).mockReturnValue(frameContext);

            // Chromium resolves the code injection after an in-page exception
            // with no value, which must not pass as an applied rule set.
            vi.mocked(TabsApi.injectScript).mockResolvedValue(undefined);

            const injection = CosmeticApi.applyExtCss(1, 0);
            await vi.runAllTimersAsync();
            const isApplied = await injection;

            expect(isApplied).toBe(false);
            expect(frameContext.extCssAppliedData).toBeUndefined();
            // The operation left the queue and released its marker.
            expect(frameContext.extCssInjectionChain).toBeUndefined();
            expect(frameContext.extCssInjectionMarker).toBeUndefined();

            // A later call is not blocked by the failed operation.
            vi.mocked(TabsApi.injectScript).mockResolvedValue(true);

            const isAppliedLater = await CosmeticApi.applyExtCss(1, 0);

            expect(isAppliedLater).toBe(true);
            expect(frameContext.extCssAppliedData).toEqual(rules);
        } finally {
            vi.useRealTimers();
        }
    });

    it('clears the applied record when the replacement fails and applies again later', async () => {
        vi.useFakeTimers();

        try {
            const firstRules = ['.ad:has(.child) { display: none !important; }'];
            const secondRules = ['.banner:has(.close) { display: none !important; }'];
            const frameContext = makeFrameContext(makePrepared(firstRules));
            vi.mocked(tabsApi.getFrameContext).mockReturnValue(frameContext);

            await CosmeticApi.applyExtCss(1, 0);
            expect(frameContext.extCssAppliedData).toEqual(firstRules);

            // The replacement throws in the page, and so does the restore of
            // the previous rule set, so the document may hold no rule set.
            frameContext.preparedCosmeticResult = makePrepared(secondRules);
            const injectionsBefore = vi.mocked(TabsApi.injectScript).mock.calls.length;
            vi.mocked(TabsApi.injectScript).mockResolvedValue(undefined);

            const injection = CosmeticApi.applyExtCss(1, 0);
            await vi.runAllTimersAsync();
            const isApplied = await injection;

            expect(isApplied).toBe(false);
            // The record must not keep claiming the previous rule set.
            expect(frameContext.extCssAppliedData).toBeUndefined();
            expect(frameContext.extCssHitsMarkersApplied).toBe(false);
            expect(frameContext.extCssInstanceMayExist).toBe(true);

            // A later request for the first rule set injects again instead of
            // trusting the stale record.
            vi.mocked(TabsApi.injectScript).mockResolvedValue(true);
            frameContext.preparedCosmeticResult = makePrepared(firstRules);

            const isAppliedLater = await CosmeticApi.applyExtCss(1, 0);

            expect(isAppliedLater).toBe(true);
            expect(vi.mocked(TabsApi.injectScript).mock.calls.length).toBeGreaterThan(injectionsBefore);
            expect(frameContext.extCssAppliedData).toEqual(firstRules);
        } finally {
            vi.useRealTimers();
        }
    });

    it('re-injects when the stored rule set changes', async () => {
        const firstRules = ['.ad:has(.child) { display: none !important; }'];
        const secondRules = ['.banner:has(.close) { display: none !important; }'];
        const frameContext = makeFrameContext(makePrepared(firstRules), true);
        vi.mocked(tabsApi.getFrameContext).mockReturnValue(frameContext);

        frameContext.preparedCosmeticResult = makePrepared(secondRules);

        await CosmeticApi.applyExtCss(1, 0);

        expect(TabsApi.injectScript).toHaveBeenCalledWith(
            1,
            0,
            serializeExtCssForCode(secondRules, false, EXTCSS_PROTOCOL),
        );
    });

    it('records the disposed document after a successful dispose', async () => {
        const frameContext = makeFrameContext(makePrepared(null), false, true);
        vi.mocked(tabsApi.getFrameContext).mockReturnValue(frameContext);

        await CosmeticApi.applyExtCss(1, 0);

        expect(frameContext.extCssDisposedDocumentVersion).toBe(0);
    });

    it('retries after 10 ms when injection fails', async () => {
        vi.useFakeTimers();
        const rules = ['.ad:has(.child) { display: none !important; }'];
        const frameContext = makeFrameContext(makePrepared(rules));
        vi.mocked(tabsApi.getFrameContext).mockReturnValue(frameContext);
        vi.mocked(TabsApi.injectScript)
            .mockRejectedValueOnce(new Error('Missing host permission'))
            .mockResolvedValueOnce(true);

        const injection = CosmeticApi.applyExtCss(1, 0);

        await vi.advanceTimersByTimeAsync(0);

        expect(TabsApi.injectScript).toHaveBeenCalledTimes(1);
        expect(frameContext.extCssAppliedData).toBeUndefined();

        await vi.advanceTimersByTimeAsync(10);
        await injection;

        expect(TabsApi.injectScript).toHaveBeenCalledTimes(2);
        expect(frameContext.extCssAppliedData).toEqual(rules);
    });

    it('does not retry when the frame context is gone', async () => {
        vi.useFakeTimers();
        const rules = ['.ad:has(.child) { display: none !important; }'];
        const frameContext = makeFrameContext(makePrepared(rules));
        let currentContext: FrameMV2 | undefined = frameContext;
        vi.mocked(tabsApi.getFrameContext).mockImplementation(() => currentContext);
        vi.mocked(TabsApi.injectScript).mockImplementation(async () => {
            // The document the payload belongs to is gone when the call fails.
            currentContext = undefined;
            throw new Error('The frame was removed');
        });

        const isApplied = await CosmeticApi.applyExtCss(1, 0);

        expect(isApplied).toBe(false);
        expect(TabsApi.injectScript).toHaveBeenCalledTimes(1);
        // Nothing can apply these rules any more, so the marker is released.
        expect(frameContext.extCssInjectionMarker).toBeUndefined();

        await vi.advanceTimersByTimeAsync(10);

        expect(TabsApi.injectScript).toHaveBeenCalledTimes(1);
    });

    it('does not retry a resolved engine guard failure and logs it as an error', async () => {
        vi.useFakeTimers();
        const rules = ['.ad:has(.child) { display: none !important; }'];
        const frameContext = makeFrameContext(makePrepared(rules));
        vi.mocked(tabsApi.getFrameContext).mockReturnValue(frameContext);
        vi.mocked(TabsApi.injectScript).mockResolvedValueOnce({
            error: 'engine-not-loaded' as ExtCssApplyResult['error'],
            message: 'ExtendedCss engine is not loaded',
        });
        const errorSpy = vi.spyOn(logger, 'error');

        const isApplied = await CosmeticApi.applyExtCss(1, 0);

        // The guard failure is terminal: neither applied nor retried.
        expect(isApplied).toBe(false);
        expect(TabsApi.injectScript).toHaveBeenCalledTimes(1);
        expect(frameContext.extCssAppliedData).toBeUndefined();
        // No retry is pending, so a later event may try again.
        expect(frameContext.extCssInjectionMarker).toBeUndefined();
        expect(errorSpy).toHaveBeenCalledWith(
            expect.stringContaining('engine-not-loaded'),
        );

        // Another attempt cannot install the missing asset.
        await vi.advanceTimersByTimeAsync(10);

        expect(TabsApi.injectScript).toHaveBeenCalledTimes(1);
    });

    it('reports a failed apply when the engine script url is empty', async () => {
        const rules = ['.ad:has(.child) { display: none !important; }'];
        const frameContext = makeFrameContext(makePrepared(rules));
        vi.mocked(tabsApi.getFrameContext).mockReturnValue(frameContext);
        const { configuration } = appContext;
        if (!configuration) {
            throw new Error('The test configuration must be set');
        }
        const { extCssScriptUrl } = configuration.settings;
        configuration.settings.extCssScriptUrl = '';
        const errorSpy = vi.spyOn(logger, 'error');

        try {
            const isApplied = await CosmeticApi.applyExtCss(1, 0);

            // Without the asset the rules cannot be applied, so the operation
            // reports a failure instead of running the payload.
            expect(isApplied).toBe(false);
            expect(TabsApi.injectScriptFile).not.toHaveBeenCalled();
            expect(TabsApi.injectScript).not.toHaveBeenCalled();
            expect(errorSpy).toHaveBeenCalledTimes(1);
        } finally {
            configuration.settings.extCssScriptUrl = extCssScriptUrl;
        }
    });

    it('reports a failed apply when the code injection throws after the asset was injected', async () => {
        vi.useFakeTimers();

        try {
            const rules = ['.ad:has(.child) { display: none !important; }'];
            const frameContext = makeFrameContext(makePrepared(rules));
            vi.mocked(tabsApi.getFrameContext).mockReturnValue(frameContext);
            vi.mocked(TabsApi.injectScript).mockRejectedValue(
                new Error('Cannot access contents of the page'),
            );

            const injection = CosmeticApi.applyExtCss(1, 0);
            await vi.runAllTimersAsync();
            const isApplied = await injection;

            // The asset was injected, but the apply never reached the page.
            expect(isApplied).toBe(false);
            expect(TabsApi.injectScriptFile).toHaveBeenCalled();
            expect(frameContext.extCssAppliedData).toBeUndefined();
        } finally {
            vi.useRealTimers();
        }
    });

    it('keeps the in-flight marker while a retry is pending', async () => {
        vi.useFakeTimers();

        try {
            const frameContext = makeFrameContext(makePrepared(
                ['.ad:has(.child) { display: none !important; }'],
            ));
            vi.mocked(tabsApi.getFrameContext).mockReturnValue(frameContext);
            vi.mocked(TabsApi.injectScript)
                .mockRejectedValueOnce(new Error('Missing host permission'))
                .mockResolvedValue(true);

            const injection = CosmeticApi.applyExtCss(1, 0);

            // The attempt fails and the operation waits for its retry, so the
            // marker must stay set: an event arriving in the gap would
            // otherwise send the same payload again.
            await vi.advanceTimersByTimeAsync(0);
            expect(TabsApi.injectScript).toHaveBeenCalledTimes(1);
            expect(frameContext.extCssInjectionMarker).toBeDefined();

            await CosmeticApi.applyExtCss(1, 0);

            expect(TabsApi.injectScript).toHaveBeenCalledTimes(1);

            // The retry belongs to the same operation and settles with it.
            await vi.advanceTimersByTimeAsync(10);
            await injection;

            expect(TabsApi.injectScript).toHaveBeenCalledTimes(2);
            expect(frameContext.extCssInjectionMarker).toBeUndefined();
        } finally {
            vi.useRealTimers();
        }
    });

    it('keeps the marker of a newer injection when an older one resolves', async () => {
        const frameContext = makeFrameContext(makePrepared(
            ['.ad:has(.child) { display: none !important; }'],
        ));
        vi.mocked(tabsApi.getFrameContext).mockReturnValue(frameContext);

        let resolveFirst!: (result: boolean) => void;
        let resolveSecond!: (result: boolean) => void;
        vi.mocked(TabsApi.injectScript)
            .mockImplementationOnce(() => new Promise<boolean>((resolve) => {
                resolveFirst = resolve;
            }))
            .mockImplementationOnce(() => new Promise<boolean>((resolve) => {
                resolveSecond = resolve;
            }));

        const first = CosmeticApi.applyExtCss(1, 0);

        // Wait until the code-string injection of the first call is in flight:
        // it runs after the engine asset call, in a microtask.
        await vi.waitFor(() => {
            expect(TabsApi.injectScript).toHaveBeenCalledTimes(1);
        });

        // A same-URL commit keeps the context and bumps the document version,
        // so the commit handler starts its own injection for the new document.
        frameContext.extCssDocumentVersion += 1;

        const second = CosmeticApi.applyExtCss(1, 0);

        await vi.waitFor(() => {
            expect(TabsApi.injectScript).toHaveBeenCalledTimes(2);
        });

        resolveFirst(true);
        await first;

        // The first injection belongs to the previous document, so it must not
        // release the marker of the second one.
        expect(frameContext.extCssInjectionMarker).toBeDefined();

        resolveSecond(true);
        await second;

        expect(frameContext.extCssInjectionMarker).toBeUndefined();
    });

    it('logs at debug after the retry budget', async () => {
        vi.useFakeTimers();

        const error = new Error('Missing host permission');
        vi.mocked(tabsApi.getFrameContext)
            .mockReturnValue(makeFrameContext(makePrepared(['.ad { display: none !important; }'])));
        vi.mocked(TabsApi.injectScript).mockRejectedValue(error);
        const debugSpy = vi.spyOn(logger, 'debug');

        // The retries belong to the operation, so the operation settles only
        // after the whole budget is spent.
        const injection = CosmeticApi.applyExtCss(1, 0);
        await vi.runAllTimersAsync();
        await injection;

        expect(debugSpy).toHaveBeenCalledWith(
            expect.stringContaining('[tsweb.CosmeticApi.injectExtCssWithRetries]'),
            error,
        );
    });

    it('ends a retry chain when the document changed', async () => {
        vi.useFakeTimers();
        const rules = ['.ad:has(.child) { display: none !important; }'];
        const frameContext = makeFrameContext(makePrepared(rules));
        vi.mocked(tabsApi.getFrameContext).mockReturnValue(frameContext);

        let resolveSecond!: (result: boolean) => void;
        vi.mocked(TabsApi.injectScript)
            .mockRejectedValueOnce(new Error('Missing host permission'))
            .mockImplementationOnce(() => new Promise<boolean>((resolve) => {
                resolveSecond = resolve;
            }));

        const first = CosmeticApi.applyExtCss(1, 0);

        // The first attempt fails and the operation waits for its retry.
        await vi.advanceTimersByTimeAsync(0);

        // A same-URL commit keeps the context and starts its own operation
        // from the commit handler, which is still in flight when the retry
        // wakes up.
        frameContext.extCssDocumentVersion += 1;
        frameContext.extCssAppliedData = undefined;
        const second = CosmeticApi.applyExtCss(1, 0);

        await vi.advanceTimersByTimeAsync(10);

        // The retry belongs to the previous document, so it neither sends its
        // payload again nor releases the marker of the new operation.
        expect(TabsApi.injectScript).toHaveBeenCalledTimes(2);
        expect(frameContext.extCssInjectionMarker).toBe(1);

        resolveSecond(true);
        await second;
        await first;

        expect(frameContext.extCssInjectionMarker).toBeUndefined();
    });

    it('does not record a failed disposal and does not retry it within the event', async () => {
        vi.useFakeTimers();

        try {
            const frameContext = makeFrameContext(makePrepared(null), false, true);
            vi.mocked(tabsApi.getFrameContext).mockReturnValue(frameContext);
            vi.mocked(TabsApi.injectScript).mockRejectedValue(new Error('Missing host permission'));

            const isDisposed = await CosmeticApi.applyExtCss(1, 0);

            expect(isDisposed).toBe(false);
            expect(TabsApi.injectScript).toHaveBeenCalledTimes(1);

            await vi.advanceTimersByTimeAsync(20);

            // The disposal keeps its one-attempt-per-event policy: no retry is
            // armed, and the failed attempt is not recorded as a disposal.
            expect(TabsApi.injectScript).toHaveBeenCalledTimes(1);
            expect(frameContext.extCssInjectionMarker).toBeUndefined();
            expect(frameContext.extCssDisposedDocumentVersion).toBeUndefined();
            expect(frameContext.extCssInstanceMayExist).toBe(true);
        } finally {
            vi.useRealTimers();
        }
    });

    it('does not record the disposed document when the disposal returns no sentinel', async () => {
        const frameContext = makeFrameContext(makePrepared(null), false, true);
        vi.mocked(tabsApi.getFrameContext).mockReturnValue(frameContext);
        // Chromium resolves the code injection with no value when the in-page
        // disposal throws.
        vi.mocked(TabsApi.injectScript).mockResolvedValue(undefined);

        const isDisposed = await CosmeticApi.applyExtCss(1, 0);

        expect(isDisposed).toBe(false);
        expect(frameContext.extCssDisposedDocumentVersion).toBeUndefined();

        // A later event disposes again, and a successful attempt is recorded.
        vi.mocked(TabsApi.injectScript).mockResolvedValue(true);

        const isDisposedLater = await CosmeticApi.applyExtCss(1, 0);

        expect(isDisposedLater).toBe(true);
        expect(TabsApi.injectScript).toHaveBeenCalledTimes(2);
        expect(frameContext.extCssDisposedDocumentVersion).toBe(0);
    });

    it('does not trust the applied rule set after a failed disposal', async () => {
        const rules = ['.ad:has(.child) { display: none !important; }'];
        const frameContext = makeFrameContext(makePrepared(rules));
        vi.mocked(tabsApi.getFrameContext).mockReturnValue(frameContext);

        await CosmeticApi.applyExtCss(1, 0);
        expect(frameContext.extCssAppliedData).toEqual(rules);

        // The rule set becomes empty and the disposal throws in the page.
        frameContext.preparedCosmeticResult = makePrepared(null);
        vi.mocked(TabsApi.injectScript).mockResolvedValue(undefined);

        expect(await CosmeticApi.applyExtCss(1, 0)).toBe(false);

        // The instance may be torn down, so its rule set cannot authorize the
        // equal-rules no-op, and the context keeps signaling that an instance
        // may be present.
        expect(frameContext.extCssAppliedData).toBeUndefined();
        expect(frameContext.extCssInstanceMayExist).toBe(true);

        // The same rules arrive again and are applied for real.
        vi.mocked(TabsApi.injectScript).mockResolvedValue(true);
        frameContext.preparedCosmeticResult = makePrepared(rules);
        const callsBefore = vi.mocked(TabsApi.injectScript).mock.calls.length;

        expect(await CosmeticApi.applyExtCss(1, 0)).toBe(true);
        expect(vi.mocked(TabsApi.injectScript).mock.calls.length).toBeGreaterThan(callsBefore);
        expect(frameContext.extCssAppliedData).toEqual(rules);
    });

    it('disposes again after a failed replacement that followed a disposal', async () => {
        vi.useFakeTimers();

        try {
            const rules = ['.ad:has(.child) { display: none !important; }'];
            const frameContext = makeFrameContext(makePrepared(null), false, true);
            vi.mocked(tabsApi.getFrameContext).mockReturnValue(frameContext);

            // The empty rule set is disposed and the disposal is recorded.
            await CosmeticApi.applyExtCss(1, 0);
            expect(frameContext.extCssDisposedDocumentVersion).toBe(0);

            // A non-empty rule set arrives and its apply fails.
            frameContext.preparedCosmeticResult = makePrepared(rules);
            vi.mocked(TabsApi.injectScript).mockResolvedValue(undefined);
            const injection = CosmeticApi.applyExtCss(1, 0);
            await vi.runAllTimersAsync();

            expect(await injection).toBe(false);
            // The stale marker must not describe the document any more.
            expect(frameContext.extCssDisposedDocumentVersion).toBeUndefined();

            // The rule set is empty again, so the disposal must run again
            // instead of being skipped by the previous marker.
            vi.mocked(TabsApi.injectScript).mockResolvedValue(true);
            frameContext.preparedCosmeticResult = makePrepared(null);
            const callsBefore = vi.mocked(TabsApi.injectScript).mock.calls.length;

            expect(await CosmeticApi.applyExtCss(1, 0)).toBe(true);

            expect(vi.mocked(TabsApi.injectScript).mock.calls.length).toBe(callsBefore + 1);
            expect(vi.mocked(TabsApi.injectScript).mock.lastCall?.[2])
                .toBe(serializeExtCssDisposeForCode(EXTCSS_PROTOCOL));
        } finally {
            vi.useRealTimers();
        }
    });

    it('retries the disposal on a later event after a failed attempt', async () => {
        const frameContext = makeFrameContext(makePrepared(null), false, true);
        vi.mocked(tabsApi.getFrameContext).mockReturnValue(frameContext);
        vi.mocked(TabsApi.injectScript).mockRejectedValue(new Error('Missing host permission'));

        await CosmeticApi.applyExtCss(1, 0);
        await CosmeticApi.applyExtCss(1, 0);

        expect(TabsApi.injectScript).toHaveBeenCalledTimes(2);
        expect(frameContext.extCssDisposedDocumentVersion).toBeUndefined();
    });

    it('skips the injection when an equal rule set was applied', async () => {
        const frameContext = makeFrameContext(
            makePrepared(['.ad:has(.child) { display: none !important; }']),
            true,
        );
        // The on-demand path rebuilds the rule strings on every request, so
        // the applied state is compared by value rather than by reference.
        frameContext.preparedCosmeticResult = makePrepared(
            ['.ad:has(.child) { display: none !important; }'],
        );
        vi.mocked(tabsApi.getFrameContext).mockReturnValue(frameContext);

        await CosmeticApi.applyExtCss(1, 0);

        expect(TabsApi.injectScript).not.toHaveBeenCalled();
    });

    it('skips the injection when only the hits statistics flag changes', async () => {
        const rules = ['.ad:has(.child) { display: none !important; }'];
        const frameContext = makeFrameContext(makePrepared(rules), true);
        vi.mocked(tabsApi.getFrameContext).mockReturnValue(frameContext);

        frameContext.preparedCosmeticResult = makePrepared(rules, true);

        await CosmeticApi.applyExtCss(1, 0);

        // The payload keeps its rule strings and skips any call with the same
        // ones, so a flag-only change would never reach the page.
        expect(TabsApi.injectScript).not.toHaveBeenCalled();
    });

    it('does not serialize the rule set to check the applied state', async () => {
        const rules = ['.ad:has(.child) { display: none !important; }'];
        const frameContext = makeFrameContext(makePrepared(rules), true);
        vi.mocked(tabsApi.getFrameContext).mockReturnValue(frameContext);
        const stringifySpy = vi.spyOn(JSON, 'stringify');

        await CosmeticApi.applyExtCss(1, 0);

        expect(TabsApi.injectScript).not.toHaveBeenCalled();
        expect(stringifySpy).not.toHaveBeenCalled();
    });

    it('starts a queued payload only after the previous one settles', async () => {
        const unmarkedRules = ['.ad:has(.child) { display: none !important; }'];
        const markedRules = [
            ".ad:has(.child) { display: none !important; content: 'adguard0%3B1' !important; }",
        ];
        const frameContext = makeFrameContext(makePrepared(unmarkedRules));
        vi.mocked(tabsApi.getFrameContext).mockReturnValue(frameContext);

        const resolvers: Array<(result: boolean) => void> = [];
        vi.mocked(TabsApi.injectScript).mockImplementation(() => new Promise<boolean>((resolve) => {
            resolvers.push(resolve);
        }));

        const unmarked = CosmeticApi.applyExtCss(1, 0);

        // The engine asset is injected before the code string, so the code
        // injection of the unmarked payload starts in a microtask.
        await vi.waitFor(() => {
            expect(TabsApi.injectScript).toHaveBeenCalledTimes(1);
        });

        const marked = CosmeticApi.applyExtCss(1, 0, {
            extCssData: { extCssRules: markedRules, areHitsStatsCollected: true },
            force: true,
        });

        // The injected payload disposes the current instance before it
        // applies, so the marked copy waits for the unmarked one to settle.
        await flushOperations();
        expect(TabsApi.injectScript).toHaveBeenCalledTimes(1);
        expect(frameContext.extCssAppliedData).toBeUndefined();

        resolvers[0](true);
        await unmarked;

        await vi.waitFor(() => {
            expect(TabsApi.injectScript).toHaveBeenCalledTimes(2);
        });

        resolvers[1](true);
        await marked;

        expect(frameContext.extCssAppliedData).toEqual(markedRules);
        expect(frameContext.extCssHitsMarkersApplied).toBe(true);
        expect(frameContext.extCssInjectionMarker).toBeUndefined();
        expect(frameContext.extCssInjectionChain).toBeUndefined();
    });

    it('does not replace a marked rule set with an unmarked payload', async () => {
        const unmarkedRules = ['.ad:has(.child) { display: none !important; }'];
        const markedRules = [
            ".ad:has(.child) { display: none !important; content: 'adguard0%3B1' !important; }",
        ];
        const frameContext = makeFrameContext(makePrepared(unmarkedRules));
        vi.mocked(tabsApi.getFrameContext).mockReturnValue(frameContext);

        await CosmeticApi.applyExtCss(1, 0, {
            extCssData: { extCssRules: markedRules, areHitsStatsCollected: true },
            force: true,
        });
        await CosmeticApi.applyExtCss(1, 0);

        // The prepared payload was built before collection was enabled, so it
        // would stop the ExtendedCSS hit reporting of the marked instance.
        expect(TabsApi.injectScript).toHaveBeenCalledTimes(1);
        expect(frameContext.extCssAppliedData).toEqual(markedRules);
        expect(frameContext.extCssHitsMarkersApplied).toBe(true);
    });
});
