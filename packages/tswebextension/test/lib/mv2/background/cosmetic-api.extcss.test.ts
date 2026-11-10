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
 * Builds the applied rule-set signature the API compares against.
 *
 * @param extCssRules ExtCSS rules, or null when none match.
 * @param areHitsStatsCollected Whether hits statistics are collected.
 *
 * @returns The signature.
 */
const makeAppliedSignature = (
    extCssRules: string[] | null,
    areHitsStatsCollected = false,
): string => JSON.stringify([extCssRules, areHitsStatsCollected]);

/**
 * Creates a frame context with the given prepared result.
 *
 * @param preparedCosmeticResult Prepared cosmetic result, if any.
 * @param isApplied Whether the prepared rule set is already applied to the document.
 *
 * @returns The frame context.
 */
const makeFrameContext = (
    preparedCosmeticResult?: PreparedCosmeticResultMV2,
    isApplied = false,
): FrameMV2 => {
    const frameContext = new FrameMV2({
        url: 'https://example.com/',
        tabId: 1,
        frameId: 0,
        parentFrameId: -1,
        timeStamp: Date.now(),
    });
    frameContext.preparedCosmeticResult = preparedCosmeticResult;
    if (isApplied) {
        frameContext.extCssAppliedSignature = makeAppliedSignature(
            preparedCosmeticResult?.extCssRules ?? null,
            preparedCosmeticResult?.areHitsStatsCollected ?? false,
        );
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
            .mockReturnValue(makeFrameContext(makePrepared([])));

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
            .mockReturnValue(makeFrameContext(makePrepared(null)));

        await CosmeticApi.applyExtCss(1, 0);

        expect(TabsApi.injectScript).toHaveBeenCalledTimes(1);
        expect(TabsApi.injectScript).toHaveBeenCalledWith(
            1,
            0,
            serializeExtCssDisposeForCode(EXTCSS_PROTOCOL),
        );
    });

    it('disposes once per document even when no instance was reported', async () => {
        const frameContext = makeFrameContext(makePrepared([]));
        vi.mocked(tabsApi.getFrameContext).mockReturnValue(frameContext);

        await CosmeticApi.applyExtCss(1, 0);
        await CosmeticApi.applyExtCss(1, 0);

        expect(TabsApi.injectScript).toHaveBeenCalledTimes(1);
        expect(frameContext.extCssDisposedDocumentVersion).toBe(0);
    });

    it('disposes again for the next document', async () => {
        const frameContext = makeFrameContext(makePrepared([]));
        vi.mocked(tabsApi.getFrameContext).mockReturnValue(frameContext);

        await CosmeticApi.applyExtCss(1, 0);

        frameContext.extCssDocumentVersion += 1;
        await CosmeticApi.applyExtCss(1, 0);

        expect(TabsApi.injectScript).toHaveBeenCalledTimes(2);
    });

    it('disposes again after a rule set is applied later in the same document', async () => {
        const rules = ['.ad:has(.child) { display: none !important; }'];
        const frameContext = makeFrameContext(makePrepared([]));
        vi.mocked(tabsApi.getFrameContext).mockReturnValue(frameContext);

        await CosmeticApi.applyExtCss(1, 0);

        frameContext.preparedCosmeticResult = makePrepared(rules);
        await CosmeticApi.applyExtCss(1, 0);

        frameContext.preparedCosmeticResult = makePrepared([]);
        await CosmeticApi.applyExtCss(1, 0);

        expect(TabsApi.injectScript).toHaveBeenCalledTimes(3);
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
        expect(original.extCssAppliedSignature).toBeUndefined();
        expect(replacement.extCssAppliedSignature).toBeUndefined();
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
        frameContext.extCssAppliedSignature = undefined;

        resolveInjection();
        await injection;

        expect(frameContext.extCssAppliedSignature).toBeUndefined();
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

        expect(frameContext.extCssAppliedSignature).toBe(makeAppliedSignature(rules));
    });

    it('records the applied rule set after a successful apply', async () => {
        const rules = ['.ad:has(.child) { display: none !important; }'];
        const frameContext = makeFrameContext(makePrepared(rules));
        vi.mocked(tabsApi.getFrameContext).mockReturnValue(frameContext);

        await CosmeticApi.applyExtCss(1, 0);

        expect(frameContext.extCssAppliedSignature).toBe(makeAppliedSignature(rules));
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
        const frameContext = makeFrameContext(makePrepared(null));
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
        expect(frameContext.extCssAppliedSignature).toBeUndefined();

        await vi.advanceTimersByTimeAsync(10);

        expect(TabsApi.injectScript).toHaveBeenCalledTimes(2);
        expect(frameContext.extCssAppliedSignature).toBe(makeAppliedSignature(rules));
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

        await CosmeticApi.applyExtCss(1, 0, 100);

        expect(debugSpy).toHaveBeenCalledWith(
            expect.stringContaining('[tsweb.CosmeticApi.applyExtCss]'),
            error,
        );
    });

    it('does not record the disposal when it fails', async () => {
        const frameContext = makeFrameContext(makePrepared(null));
        vi.mocked(tabsApi.getFrameContext).mockReturnValue(frameContext);
        vi.mocked(TabsApi.injectScript).mockRejectedValue(new Error('Missing host permission'));

        await CosmeticApi.applyExtCss(1, 0, 100);

        expect(frameContext.extCssDisposedDocumentVersion).toBeUndefined();
    });
});
