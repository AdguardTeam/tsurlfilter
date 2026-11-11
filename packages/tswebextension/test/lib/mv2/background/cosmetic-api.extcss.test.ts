import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import { EXTCSS_PROTOCOL } from '../../../../src/lib/common/extcss-protocol';
import { logger } from '../../../../src/lib/common/utils/logger';
import { tabsApi } from '../../../../src/lib/mv2/background/api';
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
    appContext: {},
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

describe('CosmeticApi.applyExtCss', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        vi.mocked(tabsApi.getFrameContext).mockReset();
        vi.spyOn(TabsApi, 'injectScript').mockResolvedValue();
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

    it('does not mark a frame context that was replaced during the injection', async () => {
        const rules = ['.ad:has(.child) { display: none !important; }'];
        const original = makeFrameContext(makePrepared(rules));
        const replacement = makeFrameContext(makePrepared(rules));

        vi.mocked(tabsApi.getFrameContext)
            .mockReturnValueOnce(original)
            .mockReturnValueOnce(replacement);

        await CosmeticApi.applyExtCss(1, 0);

        expect(TabsApi.injectScript).toHaveBeenCalledTimes(1);
        expect(original.extCssAppliedData).toBeUndefined();
        expect(replacement.extCssAppliedData).toBeUndefined();
    });

    it('does not mark a document that was committed during the injection', async () => {
        const rules = ['.ad:has(.child) { display: none !important; }'];
        const frameContext = makeFrameContext(makePrepared(rules));
        vi.mocked(tabsApi.getFrameContext).mockReturnValue(frameContext);

        let resolveInjection!: () => void;
        vi.mocked(TabsApi.injectScript).mockImplementation(() => new Promise<void>((resolve) => {
            resolveInjection = resolve;
        }));

        const injection = CosmeticApi.applyExtCss(1, 0);

        // A same-URL commit keeps the context and bumps the document version.
        frameContext.extCssDocumentVersion += 1;
        frameContext.extCssAppliedData = undefined;

        resolveInjection();
        await injection;

        expect(frameContext.extCssAppliedData).toBeUndefined();
    });

    it('does not inject again while an injection is in flight', async () => {
        const rules = ['.ad:has(.child) { display: none !important; }'];
        const frameContext = makeFrameContext(makePrepared(rules));
        vi.mocked(tabsApi.getFrameContext).mockReturnValue(frameContext);

        let resolveInjection!: () => void;
        vi.mocked(TabsApi.injectScript).mockImplementation(() => new Promise<void>((resolve) => {
            resolveInjection = resolve;
        }));

        const injection = CosmeticApi.applyExtCss(1, 0);
        await CosmeticApi.applyExtCss(1, 0);

        expect(TabsApi.injectScript).toHaveBeenCalledTimes(1);

        resolveInjection();
        await injection;

        expect(frameContext.extCssAppliedData).toEqual(rules);
    });

    it('records the applied rule set after a successful apply', async () => {
        const rules = ['.ad:has(.child) { display: none !important; }'];
        const frameContext = makeFrameContext(makePrepared(rules));
        vi.mocked(tabsApi.getFrameContext).mockReturnValue(frameContext);

        await CosmeticApi.applyExtCss(1, 0);

        expect(frameContext.extCssAppliedData).toEqual(rules);
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
            .mockResolvedValueOnce();

        await CosmeticApi.applyExtCss(1, 0);

        expect(TabsApi.injectScript).toHaveBeenCalledTimes(1);
        expect(frameContext.extCssAppliedData).toBeUndefined();

        await vi.advanceTimersByTimeAsync(10);

        expect(TabsApi.injectScript).toHaveBeenCalledTimes(2);
        expect(frameContext.extCssAppliedData).toEqual(rules);
    });

    it('keeps the in-flight marker while a retry is pending', async () => {
        vi.useFakeTimers();

        try {
            const frameContext = makeFrameContext(makePrepared(
                ['.ad:has(.child) { display: none !important; }'],
            ));
            vi.mocked(tabsApi.getFrameContext).mockReturnValue(frameContext);
            vi.mocked(TabsApi.injectScript)
                .mockRejectedValue(new Error('Missing host permission'));

            // The attempt fails and schedules its retry, so the marker must
            // stay set: an event arriving in the gap would otherwise send the
            // same payload again and start a second chain.
            await CosmeticApi.applyExtCss(1, 0);

            expect(TabsApi.injectScript).toHaveBeenCalledTimes(1);
            expect(frameContext.extCssInjectionMarker).toBeDefined();

            await CosmeticApi.applyExtCss(1, 0);

            expect(TabsApi.injectScript).toHaveBeenCalledTimes(1);
        } finally {
            vi.useRealTimers();
        }
    });

    it('keeps the marker of a newer injection when an older one resolves', async () => {
        const frameContext = makeFrameContext(makePrepared(
            ['.ad:has(.child) { display: none !important; }'],
        ));
        vi.mocked(tabsApi.getFrameContext).mockReturnValue(frameContext);

        let resolveFirst!: () => void;
        let resolveSecond!: () => void;
        vi.mocked(TabsApi.injectScript)
            .mockImplementationOnce(() => new Promise<void>((resolve) => {
                resolveFirst = resolve;
            }))
            .mockImplementationOnce(() => new Promise<void>((resolve) => {
                resolveSecond = resolve;
            }));

        const first = CosmeticApi.applyExtCss(1, 0);

        // A same-URL commit keeps the context and bumps the document version,
        // so the commit handler starts its own injection for the new document.
        frameContext.extCssDocumentVersion += 1;

        const second = CosmeticApi.applyExtCss(1, 0);

        expect(TabsApi.injectScript).toHaveBeenCalledTimes(2);

        resolveFirst();
        await first;

        // The first injection belongs to the previous document, so it must not
        // release the marker of the second one.
        expect(frameContext.extCssInjectionMarker).toBeDefined();

        resolveSecond();
        await second;

        expect(frameContext.extCssInjectionMarker).toBeUndefined();
    });

    it('logs at debug after the retry budget', async () => {
        const error = new Error('Missing host permission');
        vi.mocked(tabsApi.getFrameContext)
            .mockReturnValue(makeFrameContext(makePrepared(['.ad { display: none !important; }'])));
        vi.mocked(TabsApi.injectScript).mockRejectedValue(error);
        const debugSpy = vi.spyOn(logger, 'debug');

        await CosmeticApi.applyExtCss(1, 0, 100, 0);

        expect(debugSpy).toHaveBeenCalledWith(
            expect.stringContaining('[tsweb.CosmeticApi.applyExtCss]'),
            error,
        );
    });

    it('ends a retry chain when the document changed', async () => {
        vi.useFakeTimers();
        const rules = ['.ad:has(.child) { display: none !important; }'];
        const frameContext = makeFrameContext(makePrepared(rules));
        vi.mocked(tabsApi.getFrameContext).mockReturnValue(frameContext);

        let resolveSecond!: () => void;
        vi.mocked(TabsApi.injectScript)
            .mockRejectedValueOnce(new Error('Missing host permission'))
            .mockImplementationOnce(() => new Promise<void>((resolve) => {
                resolveSecond = resolve;
            }));

        await CosmeticApi.applyExtCss(1, 0);

        // A same-URL commit keeps the context and starts its own chain from
        // the commit handler, which is still in flight when the retry fires.
        frameContext.extCssDocumentVersion += 1;
        frameContext.extCssAppliedData = undefined;
        const second = CosmeticApi.applyExtCss(1, 0);

        await vi.advanceTimersByTimeAsync(10);

        // The retry belongs to the previous document, so it neither sends its
        // payload again nor releases the marker of the new chain.
        expect(TabsApi.injectScript).toHaveBeenCalledTimes(2);
        expect(frameContext.extCssInjectionMarker).toBe(1);

        resolveSecond();
        await second;

        expect(frameContext.extCssInjectionMarker).toBeUndefined();
    });

    it('releases its marker when a retry finds the rules applied', async () => {
        vi.useFakeTimers();
        const rules = ['.ad:has(.child) { display: none !important; }'];
        const frameContext = makeFrameContext(makePrepared(rules));
        vi.mocked(tabsApi.getFrameContext).mockReturnValue(frameContext);
        vi.mocked(TabsApi.injectScript).mockRejectedValueOnce(new Error('Missing host permission'));

        await CosmeticApi.applyExtCss(1, 0);

        expect(frameContext.extCssInjectionMarker).toBe(0);

        // Another path put the rules into the document while the retry waited.
        frameContext.extCssAppliedData = rules;

        await vi.advanceTimersByTimeAsync(10);

        // Nothing is left to do, so the chain ends and a later event can try
        // again instead of being skipped by a marker nobody owns.
        expect(TabsApi.injectScript).toHaveBeenCalledTimes(1);
        expect(frameContext.extCssInjectionMarker).toBeUndefined();
    });

    it('attempts the disposal once and records it even when it fails', async () => {
        vi.useFakeTimers();
        const frameContext = makeFrameContext(makePrepared(null), false, true);
        vi.mocked(tabsApi.getFrameContext).mockReturnValue(frameContext);
        vi.mocked(TabsApi.injectScript).mockRejectedValue(new Error('Missing host permission'));

        await CosmeticApi.applyExtCss(1, 0);

        expect(TabsApi.injectScript).toHaveBeenCalledTimes(1);

        await vi.advanceTimersByTimeAsync(20);

        // The dispose has no retry, so a failed attempt cannot arm a second
        // chain, and the document is recorded as disposed all the same.
        expect(TabsApi.injectScript).toHaveBeenCalledTimes(1);
        expect(frameContext.extCssInjectionMarker).toBeUndefined();
        expect(frameContext.extCssDisposedDocumentVersion).toBe(0);
    });

    it('does not dispose again from a later event after a failed attempt', async () => {
        const frameContext = makeFrameContext(makePrepared(null), false, true);
        vi.mocked(tabsApi.getFrameContext).mockReturnValue(frameContext);
        vi.mocked(TabsApi.injectScript).mockRejectedValue(new Error('Missing host permission'));

        await CosmeticApi.applyExtCss(1, 0);
        await CosmeticApi.applyExtCss(1, 0);

        expect(TabsApi.injectScript).toHaveBeenCalledTimes(1);
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
});
