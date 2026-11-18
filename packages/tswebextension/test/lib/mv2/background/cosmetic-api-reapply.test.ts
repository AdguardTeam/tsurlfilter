import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import { CosmeticResult } from '@adguard/tsurlfilter';

import { ExtCssMarkersState } from '../../../../src/lib/common/cosmetic-api';
import { EXTCSS_PROTOCOL } from '../../../../src/lib/common/extcss-protocol';
import { logger } from '../../../../src/lib/common/utils/logger';
import { CosmeticApi } from '../../../../src/lib/mv2/background/cosmetic-api';
import { serializeExtCssForCode } from '../../../../src/lib/mv2/background/extcss-code';
import { FrameMV2, type PreparedCosmeticResultMV2 } from '../../../../src/lib/mv2/background/tabs/frame';
import { TabsApi } from '../../../../src/lib/mv2/background/tabs/tabs-api';
import { createCosmeticRule } from '../../../helpers/rule-creator';

const { appContextMock, tabsApiMock, engineApiMock } = vi.hoisted(() => ({
    appContextMock: {
        isStorageInitialized: true,
        isAppStarted: true,
        configuration: {
            settings: {
                collectStats: true,
            },
        },
    },
    tabsApiMock: {
        getTabContext: vi.fn(),
        getFrameContext: vi.fn(),
        updateFrameContext: vi.fn(),
    },
    engineApiMock: {
        matchCosmetic: vi.fn(),
    },
}));

vi.mock('../../../../src/lib/mv2/background/app-context', () => ({
    appContext: appContextMock,
}));

vi.mock('../../../../src/lib/mv2/background/api', () => ({
    engineApi: engineApiMock,
    tabsApi: tabsApiMock,
}));

vi.mock('../../../../src/lib/common/utils/css-capabilities', () => ({
    CssCapabilities: {
        isNativeHasPseudoClassSupported: (): boolean => true,
    },
}));

describe('CosmeticApi.reapplyMarkedCosmeticData', () => {
    const TAB_ID = 1;
    const FRAME_ID = 0;

    /**
     * ExtendedCSS rules of the cosmetic result, built with hit markers.
     */
    const markedExtCssRules = [
        ".banner:has(> .ad) { display: none !important; content: 'adguard0%3B1' !important; }",
    ];

    let cosmeticResult: CosmeticResult;

    /**
     * Creates a frame context for the current cosmetic result.
     *
     * @param prepared Prepared cosmetic result.
     * @param documentId Document id of the frame.
     *
     * @returns The frame context.
     */
    const makeFrameContext = (
        prepared: PreparedCosmeticResultMV2,
        documentId = 'doc-1',
    ): FrameMV2 => {
        const frameContext = new FrameMV2({
            url: 'https://example.org/',
            tabId: TAB_ID,
            frameId: FRAME_ID,
            parentFrameId: -1,
            timeStamp: Date.now(),
        });
        frameContext.documentId = documentId;
        frameContext.cosmeticResult = cosmeticResult;
        frameContext.preparedCosmeticResult = prepared;

        return frameContext;
    };

    /**
     * Creates a prepared cosmetic result with the given CSS text.
     *
     * @param cssText Prepared native CSS text.
     * @param areHitsStatsCollected Whether the CSS was built with markers.
     *
     * @returns Prepared cosmetic result.
     */
    const makePrepared = (
        cssText: string | undefined,
        areHitsStatsCollected: boolean,
    ): PreparedCosmeticResultMV2 => ({
        scriptText: '',
        cssText,
        // The prepared ExtendedCSS rules follow the collection state the
        // payload was built with: the reapply replaces an unmarked rule set.
        extCssRules: CosmeticApi.getExtCssRules(cosmeticResult, {
            areHitsStatsCollected,
            isNativeHasSupported: true,
        }),
        areHitsStatsCollected,
    });

    /**
     * Marks the prepared ExtendedCSS rules as already applied, as the initial
     * document injection does.
     *
     * @param frameContext Frame context of the loaded document.
     */
    const markExtCssInjected = (frameContext: FrameMV2): void => {
        frameContext.extCssAppliedData = frameContext.preparedCosmeticResult?.extCssRules
            ?? undefined;
        frameContext.extCssHitsMarkersApplied = false;
    };

    beforeEach(() => {
        appContextMock.configuration.settings.collectStats = true;
        tabsApiMock.getTabContext.mockReset();
        tabsApiMock.getFrameContext.mockReset();
        tabsApiMock.updateFrameContext.mockReset();
        tabsApiMock.getTabContext.mockReturnValue({
            info: { url: 'https://example.org/' },
            mainFrameRule: { isFilteringDisabled: (): boolean => false },
        });

        cosmeticResult = new CosmeticResult();
        cosmeticResult.elementHiding.append(createCosmeticRule('example.org##.banner', 0, 0));
        cosmeticResult.elementHiding.append(createCosmeticRule('example.org#?#.banner:has(> .ad)', 0, 1));
        engineApiMock.matchCosmetic.mockReset();
        engineApiMock.matchCosmetic.mockReturnValue(cosmeticResult);

        // The ExtendedCSS rules are injected from the background, so the
        // native CSS and the ExtendedCSS payload are mocked separately.
        vi.spyOn(TabsApi, 'injectScript').mockResolvedValue();
        const frameContext = makeFrameContext(makePrepared('unmarked', false));
        markExtCssInjected(frameContext);
        tabsApiMock.getFrameContext.mockReturnValue(frameContext);
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('reports the native marker state from the prepared result', () => {
        const data = CosmeticApi.getContentScriptData(
            'https://example.org/',
            TAB_ID,
            FRAME_ID,
        );

        expect(data.areHitsStatsCollected).toBe(true);
        expect(data.areNativeHitsStatsCollected).toBe(false);
        // ExtendedCSS is applied by the background, so the content script
        // never receives rule strings.
        expect(data.extCssRules).toBeNull();
        expect(data.extCssMarkersState).toBe(ExtCssMarkersState.ContentScript);
    });

    it('reports prepared markers after initial injection succeeds', async () => {
        const frameContext = makeFrameContext(makePrepared('marked', true));
        markExtCssInjected(frameContext);
        tabsApiMock.getFrameContext.mockReturnValue(frameContext);
        vi.spyOn(CosmeticApi, 'injectCss').mockResolvedValue();

        await CosmeticApi.applyCss(TAB_ID, FRAME_ID);

        const data = CosmeticApi.getContentScriptData(
            'https://example.org/',
            TAB_ID,
            FRAME_ID,
        );

        expect(data.areNativeHitsStatsCollected).toBe(true);
    });

    it('does not report prepared markers when initial injection failed', async () => {
        const frameContext = makeFrameContext(makePrepared('marked', true));
        markExtCssInjected(frameContext);
        tabsApiMock.getFrameContext.mockReturnValue(frameContext);
        vi.spyOn(CosmeticApi, 'injectCss').mockRejectedValue(new Error('injection failed'));
        vi.useFakeTimers();

        const injection = CosmeticApi.applyCss(TAB_ID, FRAME_ID);
        await vi.runAllTimersAsync();
        await injection;
        vi.useRealTimers();

        const data = CosmeticApi.getContentScriptData(
            'https://example.org/',
            TAB_ID,
            FRAME_ID,
        );

        expect(data.areNativeHitsStatsCollected).toBe(false);
    });

    it('injects the marked native CSS and the marked ExtendedCss rules', async () => {
        const injectSpy = vi.spyOn(CosmeticApi, 'injectCss').mockResolvedValue();

        const data = await CosmeticApi.reapplyMarkedCosmeticData(
            'https://example.org/',
            TAB_ID,
            FRAME_ID,
        );

        expect(data.areHitsStatsCollected).toBe(true);
        expect(data.areNativeHitsStatsCollected).toBe(true);
        expect(data.extCssRules).toBeNull();
        expect(data.extCssMarkersState).toBe(ExtCssMarkersState.Applied);

        // The native CSS is injected with hit markers.
        expect(injectSpy).toHaveBeenCalledTimes(1);
        const cssText = injectSpy.mock.calls[0][2];
        expect(cssText).toContain('--adguard-hit');

        // The marked ExtendedCSS rules replace the unmarked instance, and the
        // injection is awaited before the content script answers.
        expect(TabsApi.injectScript).toHaveBeenCalledTimes(1);
        expect(TabsApi.injectScript).toHaveBeenCalledWith(
            TAB_ID,
            FRAME_ID,
            serializeExtCssForCode(markedExtCssRules, true, EXTCSS_PROTOCOL),
        );
    });

    it('does not inject the marked data twice for the same prepared result', async () => {
        const injectSpy = vi.spyOn(CosmeticApi, 'injectCss').mockResolvedValue();

        await CosmeticApi.reapplyMarkedCosmeticData('https://example.org/', TAB_ID, FRAME_ID);
        const data = await CosmeticApi.reapplyMarkedCosmeticData(
            'https://example.org/',
            TAB_ID,
            FRAME_ID,
        );

        expect(injectSpy).toHaveBeenCalledTimes(1);
        expect(TabsApi.injectScript).toHaveBeenCalledTimes(1);
        expect(data.areNativeHitsStatsCollected).toBe(true);
        expect(data.extCssMarkersState).toBe(ExtCssMarkersState.Applied);
    });

    it('reuses the initial marked CSS injection on reapply', async () => {
        const frameContext = makeFrameContext(makePrepared('marked', true));
        markExtCssInjected(frameContext);
        tabsApiMock.getFrameContext.mockReturnValue(frameContext);
        const injectSpy = vi.spyOn(CosmeticApi, 'injectCss').mockResolvedValue();

        await CosmeticApi.applyCss(TAB_ID, FRAME_ID);
        const data = await CosmeticApi.reapplyMarkedCosmeticData(
            'https://example.org/',
            TAB_ID,
            FRAME_ID,
        );

        expect(injectSpy).toHaveBeenCalledTimes(1);
        expect(data.areNativeHitsStatsCollected).toBe(true);
    });

    it('does not inject marked CSS again when applyCss runs after reapply', async () => {
        const frameContext = makeFrameContext(makePrepared('marked', true));
        markExtCssInjected(frameContext);
        tabsApiMock.getFrameContext.mockReturnValue(frameContext);
        const injectSpy = vi.spyOn(CosmeticApi, 'injectCss').mockResolvedValue();

        await CosmeticApi.reapplyMarkedCosmeticData(
            'https://example.org/',
            TAB_ID,
            FRAME_ID,
        );
        await CosmeticApi.applyCss(TAB_ID, FRAME_ID);

        expect(injectSpy).toHaveBeenCalledTimes(1);
    });

    it('deduplicates applyCss calls while the injection is in flight', async () => {
        const frameContext = makeFrameContext(makePrepared('marked', true));
        markExtCssInjected(frameContext);
        tabsApiMock.getFrameContext.mockReturnValue(frameContext);

        let resolveInjection!: () => void;
        const injection = new Promise<void>((resolve) => {
            resolveInjection = resolve;
        });
        const injectSpy = vi.spyOn(CosmeticApi, 'injectCss').mockReturnValue(injection);

        const first = CosmeticApi.applyCss(TAB_ID, FRAME_ID);
        const second = CosmeticApi.applyCss(TAB_ID, FRAME_ID);

        await Promise.resolve();

        expect(injectSpy).toHaveBeenCalledTimes(1);

        resolveInjection();
        await Promise.all([first, second]);

        expect(injectSpy).toHaveBeenCalledTimes(1);
    });

    it('does not reuse the cache after a document change', async () => {
        const frameContext = makeFrameContext(makePrepared('marked', true));
        markExtCssInjected(frameContext);
        tabsApiMock.getFrameContext.mockReturnValue(frameContext);
        const injectSpy = vi.spyOn(CosmeticApi, 'injectCss').mockResolvedValue();

        await CosmeticApi.applyCss(TAB_ID, FRAME_ID);
        frameContext.documentId = 'doc-2';
        await CosmeticApi.applyCss(TAB_ID, FRAME_ID);

        expect(injectSpy).toHaveBeenCalledTimes(2);
    });

    it('does not use the cache with a synthetic document id', async () => {
        const frameContext = makeFrameContext(
            makePrepared('marked', true),
            `${TAB_ID}-${FRAME_ID}`,
        );
        markExtCssInjected(frameContext);
        tabsApiMock.getFrameContext.mockReturnValue(frameContext);
        const injectSpy = vi.spyOn(CosmeticApi, 'injectCss').mockResolvedValue();

        await CosmeticApi.applyCss(TAB_ID, FRAME_ID);
        await CosmeticApi.applyCss(TAB_ID, FRAME_ID);

        expect(injectSpy).toHaveBeenCalledTimes(2);
    });

    it('reports native hits and extended markers as collected when there is no CSS', async () => {
        cosmeticResult = new CosmeticResult();
        const frameContext = makeFrameContext(makePrepared(undefined, false));
        markExtCssInjected(frameContext);
        tabsApiMock.getFrameContext.mockReturnValue(frameContext);
        const injectSpy = vi.spyOn(CosmeticApi, 'injectCss').mockResolvedValue();

        const data = await CosmeticApi.reapplyMarkedCosmeticData(
            'https://example.org/',
            TAB_ID,
            FRAME_ID,
        );

        expect(data.areNativeHitsStatsCollected).toBe(true);
        // Nothing to mark in ExtendedCSS, so no payload is injected.
        expect(data.extCssMarkersState).toBe(ExtCssMarkersState.Applied);
        expect(injectSpy).not.toHaveBeenCalled();
        expect(TabsApi.injectScript).not.toHaveBeenCalled();
    });

    it('does not inject marked CSS for an allowlisted document', async () => {
        tabsApiMock.getTabContext.mockReturnValue({
            info: { url: 'https://example.org/' },
            mainFrameRule: { isFilteringDisabled: (): boolean => true },
        });
        const frameContext = makeFrameContext(makePrepared('unmarked-allowlisted', false));
        markExtCssInjected(frameContext);
        tabsApiMock.getFrameContext.mockReturnValue(frameContext);
        const injectSpy = vi.spyOn(CosmeticApi, 'injectCss').mockResolvedValue();

        const data = await CosmeticApi.reapplyMarkedCosmeticData(
            'https://example.org/',
            TAB_ID,
            FRAME_ID,
        );

        expect(data.areHitsStatsCollected).toBe(false);
        expect(data.areNativeHitsStatsCollected).toBe(false);
        expect(data.extCssMarkersState).toBe(ExtCssMarkersState.ContentScript);
        expect(injectSpy).not.toHaveBeenCalled();
        expect(TabsApi.injectScript).not.toHaveBeenCalled();
    });

    it('injects marked CSS and marked ExtendedCss without a frame context', async () => {
        tabsApiMock.getFrameContext.mockReturnValue(undefined);
        const injectSpy = vi.spyOn(CosmeticApi, 'injectCss').mockResolvedValue();

        const data = await CosmeticApi.reapplyMarkedCosmeticData(
            'https://example.org/',
            TAB_ID,
            FRAME_ID,
        );

        expect(data.areHitsStatsCollected).toBe(true);
        expect(data.areNativeHitsStatsCollected).toBe(true);
        expect(data.extCssMarkersState).toBe(ExtCssMarkersState.Applied);
        expect(injectSpy).toHaveBeenCalledTimes(1);
        expect(TabsApi.injectScript).toHaveBeenCalledWith(
            TAB_ID,
            FRAME_ID,
            serializeExtCssForCode(markedExtCssRules, true, EXTCSS_PROTOCOL),
        );
    });

    it('stops retrying when the frame context changes', async () => {
        const frameContext = makeFrameContext(makePrepared('marked', true));
        const nextFrameContext = makeFrameContext(makePrepared('next', true), 'doc-2');
        markExtCssInjected(frameContext);
        tabsApiMock.getFrameContext.mockReturnValue(frameContext);
        const injectSpy = vi.spyOn(CosmeticApi, 'injectCss')
            .mockImplementation(async () => {
                // The frame navigated while the injection was in flight.
                tabsApiMock.getFrameContext.mockReturnValue(nextFrameContext);
                throw new Error('injection failed');
            });

        const data = await CosmeticApi.reapplyMarkedCosmeticData(
            'https://example.org/',
            TAB_ID,
            FRAME_ID,
        );

        expect(injectSpy).toHaveBeenCalledTimes(1);
        expect(data.areNativeHitsStatsCollected).toBe(false);
    });

    it('stops initial CSS retries when the frame navigates during the retry delay', async () => {
        vi.useFakeTimers();

        const frameContext = makeFrameContext(makePrepared('marked', true));
        const nextFrameContext = makeFrameContext(makePrepared('next', true), 'doc-2');
        markExtCssInjected(frameContext);
        tabsApiMock.getFrameContext.mockReturnValue(frameContext);
        const injectSpy = vi.spyOn(CosmeticApi, 'injectCss')
            .mockRejectedValue(new Error('injection failed'));

        const injection = CosmeticApi.applyCss(TAB_ID, FRAME_ID);

        await vi.advanceTimersByTimeAsync(0);
        tabsApiMock.getFrameContext.mockReturnValue(nextFrameContext);
        await vi.advanceTimersByTimeAsync(10);
        await injection;

        expect(injectSpy).toHaveBeenCalledTimes(1);
    });

    it('stops retrying when the frame navigates during the retry delay', async () => {
        vi.useFakeTimers();

        const frameContext = makeFrameContext(makePrepared('marked', true));
        const nextFrameContext = makeFrameContext(makePrepared('next', true), 'doc-2');
        markExtCssInjected(frameContext);
        tabsApiMock.getFrameContext.mockReturnValue(frameContext);
        const injectSpy = vi.spyOn(CosmeticApi, 'injectCss')
            .mockRejectedValue(new Error('injection failed'));

        const resultPromise = CosmeticApi.reapplyMarkedCosmeticData(
            'https://example.org/',
            TAB_ID,
            FRAME_ID,
        );

        await vi.advanceTimersByTimeAsync(0);
        tabsApiMock.getFrameContext.mockReturnValue(nextFrameContext);
        await vi.advanceTimersByTimeAsync(10);

        const data = await resultPromise;

        expect(injectSpy).toHaveBeenCalledTimes(1);
        expect(data.areNativeHitsStatsCollected).toBe(false);
    });

    it('does not clear the marker of a newer document on a stale reapply', async () => {
        vi.useFakeTimers();

        const frameContext = makeFrameContext(makePrepared('unmarked', false));
        markExtCssInjected(frameContext);
        tabsApiMock.getFrameContext.mockReturnValue(frameContext);
        vi.spyOn(CosmeticApi, 'injectCss').mockResolvedValue();

        const resultPromise = CosmeticApi.reapplyMarkedCosmeticData(
            'https://example.org/',
            TAB_ID,
            FRAME_ID,
        );

        // A commit of the same frame keeps the context and starts a new
        // document while the reapply is in flight.
        await vi.advanceTimersByTimeAsync(0);
        frameContext.extCssDocumentVersion += 1;
        frameContext.extCssInjectionMarker = frameContext.extCssDocumentVersion;

        await vi.advanceTimersByTimeAsync(10);
        await resultPromise;

        // The stale reapply must not release the marker of the new document.
        expect(frameContext.extCssInjectionMarker).toBe(frameContext.extCssDocumentVersion);
    });

    it('retries marked CSS injection after a transient failure', async () => {
        const injectSpy = vi.spyOn(CosmeticApi, 'injectCss')
            .mockRejectedValueOnce(new Error('transient failure'))
            .mockResolvedValue();

        const data = await CosmeticApi.reapplyMarkedCosmeticData(
            'https://example.org/',
            TAB_ID,
            FRAME_ID,
        );

        expect(injectSpy).toHaveBeenCalledTimes(2);
        expect(data.areNativeHitsStatsCollected).toBe(true);
    });

    it('keeps the marked ExtendedCss state when the marked CSS injection fails', async () => {
        vi.spyOn(CosmeticApi, 'injectCss').mockRejectedValue(new Error('injection failed'));
        const infoSpy = vi.spyOn(logger, 'info').mockImplementation(() => {});

        const data = await CosmeticApi.reapplyMarkedCosmeticData(
            'https://example.org/',
            TAB_ID,
            FRAME_ID,
        );

        expect(data.areHitsStatsCollected).toBe(true);
        expect(data.areNativeHitsStatsCollected).toBe(false);
        // The background applied the marked ExtendedCss rules, so their hits
        // are countable even though the native CSS failed.
        expect(data.extCssMarkersState).toBe(ExtCssMarkersState.Applied);
        expect(infoSpy).toHaveBeenCalledTimes(1);
    });

    it('reports a failed ExtendedCss injection to the content script', async () => {
        vi.spyOn(CosmeticApi, 'injectCss').mockResolvedValue();
        vi.spyOn(TabsApi, 'injectScript').mockRejectedValue(new Error('injection failed'));
        vi.useFakeTimers();

        const resultPromise = CosmeticApi.reapplyMarkedCosmeticData(
            'https://example.org/',
            TAB_ID,
            FRAME_ID,
        );

        await vi.runAllTimersAsync();
        const data = await resultPromise;

        expect(data.extCssMarkersState).toBe(ExtCssMarkersState.Failed);
        expect(data.areNativeHitsStatsCollected).toBe(true);
    });
});
