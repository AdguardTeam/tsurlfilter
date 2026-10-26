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
 * @param extCssApplied Whether an instance was applied to the document.
 *
 * @returns The frame context.
 */
const makeFrameContext = (
    preparedCosmeticResult?: PreparedCosmeticResultMV2,
    extCssApplied = false,
): FrameMV2 => {
    const frameContext = new FrameMV2({
        url: 'https://example.com/',
        tabId: 1,
        frameId: 0,
        parentFrameId: -1,
        timeStamp: Date.now(),
    });
    frameContext.preparedCosmeticResult = preparedCosmeticResult;
    frameContext.extCssApplied = extCssApplied;
    return frameContext;
};

describe('CosmeticApi.applyExtCss', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        vi.mocked(tabsApi.getFrameContext).mockReset();
        vi.spyOn(TabsApi, 'injectExtCss').mockResolvedValue();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('injects the serialized apply code when rules exist', async () => {
        const rules = ['.ad:has(.child) { display: none !important; }'];
        vi.mocked(tabsApi.getFrameContext).mockReturnValue(makeFrameContext(makePrepared(rules)));

        await CosmeticApi.applyExtCss(1, 0);

        expect(TabsApi.injectExtCss).toHaveBeenCalledTimes(1);
        expect(TabsApi.injectExtCss).toHaveBeenCalledWith(
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

        expect(TabsApi.injectExtCss).toHaveBeenCalledWith(
            1,
            0,
            serializeExtCssForCode(rules, true, EXTCSS_PROTOCOL),
        );
    });

    it('injects the serialized dispose code when rules are empty and an instance was applied', async () => {
        vi.mocked(tabsApi.getFrameContext)
            .mockReturnValue(makeFrameContext(makePrepared([]), true));

        await CosmeticApi.applyExtCss(1, 0);

        expect(TabsApi.injectExtCss).toHaveBeenCalledTimes(1);
        expect(TabsApi.injectExtCss).toHaveBeenCalledWith(
            1,
            0,
            serializeExtCssDisposeForCode(EXTCSS_PROTOCOL),
        );
    });

    it('injects the serialized dispose code when rules are null and an instance was applied', async () => {
        vi.mocked(tabsApi.getFrameContext)
            .mockReturnValue(makeFrameContext(makePrepared(null), true));

        await CosmeticApi.applyExtCss(1, 0);

        expect(TabsApi.injectExtCss).toHaveBeenCalledTimes(1);
        expect(TabsApi.injectExtCss).toHaveBeenCalledWith(
            1,
            0,
            serializeExtCssDisposeForCode(EXTCSS_PROTOCOL),
        );
    });

    it('does not inject when rules are empty and no instance was applied', async () => {
        vi.mocked(tabsApi.getFrameContext)
            .mockReturnValue(makeFrameContext(makePrepared([])));

        await CosmeticApi.applyExtCss(1, 0);

        expect(TabsApi.injectExtCss).not.toHaveBeenCalled();
    });

    it('does not inject when the frame context is missing', async () => {
        vi.mocked(tabsApi.getFrameContext).mockReturnValue(undefined);

        await CosmeticApi.applyExtCss(1, 0);

        expect(TabsApi.injectExtCss).not.toHaveBeenCalled();
    });

    it('does not inject when the frame has no cosmetic data', async () => {
        vi.mocked(tabsApi.getFrameContext).mockReturnValue(makeFrameContext());

        await CosmeticApi.applyExtCss(1, 0);

        expect(TabsApi.injectExtCss).not.toHaveBeenCalled();
    });

    it('falls back to the cosmetic result when the prepared result is missing', async () => {
        const rules = ['.ad:has(.child) { display: none !important; }'];
        const frameContext = makeFrameContext();
        frameContext.cosmeticResult = {} as FrameMV2['cosmeticResult'];
        vi.mocked(tabsApi.getFrameContext).mockReturnValue(frameContext);
        const getExtCssRulesSpy = vi.spyOn(CosmeticApi, 'getExtCssRules').mockReturnValue(rules);

        await CosmeticApi.applyExtCss(1, 0);

        expect(getExtCssRulesSpy).toHaveBeenCalledWith(
            frameContext.cosmeticResult,
            { areHitsStatsCollected: false, isNativeHasSupported: expect.any(Boolean) },
        );
        expect(TabsApi.injectExtCss).toHaveBeenCalledWith(
            1,
            0,
            serializeExtCssForCode(rules, false, EXTCSS_PROTOCOL),
        );
    });

    it('does not mark a frame context that was replaced during the injection', async () => {
        const rules = ['.ad:has(.child) { display: none !important; }'];
        const original = makeFrameContext(makePrepared(rules));
        const replacement = makeFrameContext(makePrepared(rules));

        vi.mocked(tabsApi.getFrameContext)
            .mockReturnValueOnce(original)
            .mockReturnValueOnce(replacement);

        await CosmeticApi.applyExtCss(1, 0);

        expect(TabsApi.injectExtCss).toHaveBeenCalledTimes(1);
        expect(original.extCssApplied).toBe(false);
        expect(replacement.extCssApplied).toBe(false);
    });

    it('marks the frame as applied after a successful apply', async () => {
        const frameContext = makeFrameContext(makePrepared(
            ['.ad:has(.child) { display: none !important; }'],
        ));
        vi.mocked(tabsApi.getFrameContext).mockReturnValue(frameContext);

        await CosmeticApi.applyExtCss(1, 0);

        expect(frameContext.extCssApplied).toBe(true);
    });

    it('clears the applied flag after a successful dispose', async () => {
        const frameContext = makeFrameContext(makePrepared(null), true);
        vi.mocked(tabsApi.getFrameContext).mockReturnValue(frameContext);

        await CosmeticApi.applyExtCss(1, 0);

        expect(frameContext.extCssApplied).toBe(false);
    });

    it('retries after 10 ms when injection fails', async () => {
        vi.useFakeTimers();
        const frameContext = makeFrameContext(makePrepared(
            ['.ad:has(.child) { display: none !important; }'],
        ));
        vi.mocked(tabsApi.getFrameContext).mockReturnValue(frameContext);
        vi.mocked(TabsApi.injectExtCss)
            .mockRejectedValueOnce(new Error('Missing host permission'))
            .mockResolvedValueOnce();

        await CosmeticApi.applyExtCss(1, 0);

        expect(TabsApi.injectExtCss).toHaveBeenCalledTimes(1);
        expect(frameContext.extCssApplied).toBe(false);

        await vi.advanceTimersByTimeAsync(10);

        expect(TabsApi.injectExtCss).toHaveBeenCalledTimes(2);
        expect(frameContext.extCssApplied).toBe(true);
    });

    it('logs at debug after the retry budget', async () => {
        const error = new Error('Missing host permission');
        vi.mocked(tabsApi.getFrameContext)
            .mockReturnValue(makeFrameContext(makePrepared(['.ad { display: none !important; }'])));
        vi.mocked(TabsApi.injectExtCss).mockRejectedValue(error);
        const debugSpy = vi.spyOn(logger, 'debug');

        await CosmeticApi.applyExtCss(1, 0, 100);

        expect(debugSpy).toHaveBeenCalledWith(
            expect.stringContaining('[tsweb.CosmeticApi.applyExtCss]'),
            error,
        );
    });

    it('keeps the applied flag when dispose fails', async () => {
        const frameContext = makeFrameContext(makePrepared(null), true);
        vi.mocked(tabsApi.getFrameContext).mockReturnValue(frameContext);
        vi.mocked(TabsApi.injectExtCss).mockRejectedValue(new Error('Missing host permission'));

        await CosmeticApi.applyExtCss(1, 0, 100);

        expect(frameContext.extCssApplied).toBe(true);
    });
});
