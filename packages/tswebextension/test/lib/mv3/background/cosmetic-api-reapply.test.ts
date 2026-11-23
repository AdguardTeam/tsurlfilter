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
import { logger } from '../../../../src/lib/common/utils/logger';
import { CosmeticApi } from '../../../../src/lib/mv3/background/cosmetic-api';
import { createCosmeticRule } from '../../../helpers/rule-creator';

const {
    appContextMock,
    tabsApiMock,
    engineApiMock,
    insertCSSMock,
    executeExtCssMock,
    disposeExtCssMock,
} = vi.hoisted(() => ({
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
    },
    engineApiMock: {
        matchCosmetic: vi.fn(),
    },
    insertCSSMock: vi.fn(),
    executeExtCssMock: vi.fn(),
    disposeExtCssMock: vi.fn(),
}));

vi.mock('../../../../src/lib/mv3/background/app-context', () => ({
    appContext: appContextMock,
}));

vi.mock('../../../../src/lib/mv3/background/engine-api', () => ({
    engineApi: engineApiMock,
}));

vi.mock('../../../../src/lib/mv3/tabs/tabs-api', () => ({
    tabsApi: tabsApiMock,
}));

vi.mock('../../../../src/lib/mv3/background/scripting-api', () => ({
    ScriptingApi: {
        insertCSS: insertCSSMock,
        executeExtCss: executeExtCssMock,
        disposeExtCss: disposeExtCssMock,
    },
}));

vi.mock('../../../../src/lib/common/utils/create-frame-match-query', () => ({
    createFrameMatchQuery: (): Record<string, unknown> => ({}),
}));

type ExtCssFrameContext = {
    documentId?: string;
    preparedCosmeticResult: {
        cssText?: string;
        extCssRules: string[] | null;
        areHitsStatsCollected: boolean;
    };
};

describe('CosmeticApi.reapplyMarkedCosmeticData', () => {
    const TAB_ID = 1;
    const FRAME_ID = 0;

    let cosmeticResult: CosmeticResult;

    const { applyCss, applyExtCssRules } = (CosmeticApi as unknown as {
        applyCss: (tabId: number, frameId: number, cssText: string) => Promise<void>;
        applyExtCssRules: (frameContext: ExtCssFrameContext) => Promise<void>;
    });

    const makeExtCssFrameContext = (documentId?: string): ExtCssFrameContext => ({
        documentId,
        preparedCosmeticResult: {
            cssText: 'unmarked',
            extCssRules: ['example.org#?#.banner:has(> .ad) { display: none !important; }'],
            areHitsStatsCollected: false,
        },
    });

    /**
     * Builds a frame context whose prepared result carries marked native CSS
     * and marked ExtendedCss rules.
     *
     * @param documentId Document id.
     *
     * @returns Marked frame context.
     */
    const makeMarkedExtCssFrameContext = (documentId?: string): ExtCssFrameContext => ({
        documentId,
        preparedCosmeticResult: {
            cssText: 'marked',
            extCssRules: ['example.org#?#.banner:has(> .ad) { display: none !important; }'],
            areHitsStatsCollected: true,
        },
    });

    /**
     * Starts an ExtendedCss injection that stays in flight until the returned
     * `resolve` is called.
     *
     * @param frameContext Frame context to inject into.
     *
     * @returns The injection promise and the function that releases it.
     */
    const startPendingExtCssInjection = async (
        frameContext: ExtCssFrameContext,
    ): Promise<{ promise: Promise<void>; resolve: () => void }> => {
        let resolveInjection: () => void = () => {};

        executeExtCssMock.mockImplementationOnce(() => new Promise<void>((resolve) => {
            resolveInjection = resolve;
        }));

        const promise = applyExtCssRules(frameContext);

        // The injection must be recorded before it settles, so it is already
        // in flight when this resolves.
        await Promise.resolve();

        return { promise, resolve: resolveInjection };
    };

    /**
     * Makes every ExtendedCss injection take one macrotask and records the
     * highest number of injections that ran at the same time.
     *
     * @returns A function that returns the highest observed concurrency.
     */
    const trackExtCssConcurrency = (): () => number => {
        let active = 0;
        let maxActive = 0;

        executeExtCssMock.mockImplementation(async () => {
            active += 1;
            maxActive = Math.max(maxActive, active);

            await new Promise<void>((resolve) => {
                setTimeout(resolve, 0);
            });

            active -= 1;
        });

        return () => maxActive;
    };

    beforeEach(() => {
        appContextMock.configuration.settings.collectStats = true;
        insertCSSMock.mockReset();
        insertCSSMock.mockResolvedValue(undefined);
        executeExtCssMock.mockReset();
        executeExtCssMock.mockResolvedValue(undefined);
        disposeExtCssMock.mockReset();
        disposeExtCssMock.mockResolvedValue(undefined);
        tabsApiMock.getTabContext.mockReset();
        tabsApiMock.getFrameContext.mockReset();
        tabsApiMock.getTabContext.mockReturnValue({
            info: { url: 'https://example.org/' },
            mainFrameRule: { isFilteringDisabled: (): boolean => false },
        });

        cosmeticResult = new CosmeticResult();
        cosmeticResult.elementHiding.append(createCosmeticRule('example.org##.banner', 0, 0));
        cosmeticResult.elementHiding.append(createCosmeticRule('example.org#?#.banner:has(> .ad)', 0, 1));
        engineApiMock.matchCosmetic.mockReturnValue(cosmeticResult);

        tabsApiMock.getFrameContext.mockReturnValue({
            documentId: 'doc-1',
            preparedCosmeticResult: {
                cssText: 'unmarked',
                areHitsStatsCollected: false,
            },
        });
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
        expect(data.extCssRules).toBeNull();
        expect(data.extCssMarkersState).toBe(ExtCssMarkersState.NotRequired);
    });

    it('reports applied ExtendedCss markers after the initial injection', async () => {
        const frameContext = makeExtCssFrameContext('doc-1');
        tabsApiMock.getFrameContext.mockReturnValue(frameContext);

        await applyExtCssRules(frameContext);

        const data = CosmeticApi.getContentScriptData(
            'https://example.org/',
            TAB_ID,
            FRAME_ID,
        );

        expect(data.extCssMarkersState).toBe(ExtCssMarkersState.Applied);
    });

    it('reports failed ExtendedCss markers after a failed initial injection', async () => {
        const frameContext = makeExtCssFrameContext('doc-1');
        tabsApiMock.getFrameContext.mockReturnValue(frameContext);
        executeExtCssMock.mockRejectedValue(new Error('injection failed'));
        vi.spyOn(logger, 'info').mockImplementation(() => {});

        await applyExtCssRules(frameContext);

        const data = CosmeticApi.getContentScriptData(
            'https://example.org/',
            TAB_ID,
            FRAME_ID,
        );

        expect(data.extCssMarkersState).toBe(ExtCssMarkersState.Failed);
    });

    it('reports prepared markers after initial injection succeeds', async () => {
        tabsApiMock.getFrameContext.mockReturnValue({
            preparedCosmeticResult: {
                cssText: 'marked',
                areHitsStatsCollected: true,
            },
        });

        await applyCss(TAB_ID, FRAME_ID, 'marked');

        const data = CosmeticApi.getContentScriptData(
            'https://example.org/',
            TAB_ID,
            FRAME_ID,
        );

        expect(data.areNativeHitsStatsCollected).toBe(true);
    });

    it('does not report prepared markers when initial injection failed', async () => {
        tabsApiMock.getFrameContext.mockReturnValue({
            preparedCosmeticResult: {
                cssText: 'marked',
                areHitsStatsCollected: true,
            },
        });
        insertCSSMock.mockRejectedValue(new Error('injection failed'));

        await applyCss(TAB_ID, FRAME_ID, 'marked');

        const data = CosmeticApi.getContentScriptData(
            'https://example.org/',
            TAB_ID,
            FRAME_ID,
        );

        expect(data.areNativeHitsStatsCollected).toBe(false);
    });

    it('injects marked native CSS and marked ExtendedCss rules', async () => {
        const data = await CosmeticApi.reapplyMarkedCosmeticData(
            'https://example.org/',
            TAB_ID,
            FRAME_ID,
        );

        expect(data.areHitsStatsCollected).toBe(true);
        expect(data.areNativeHitsStatsCollected).toBe(true);
        expect(data.extCssRules).toBeNull();
        expect(executeExtCssMock).toHaveBeenCalledTimes(1);
        expect(executeExtCssMock).toHaveBeenCalledWith(expect.objectContaining({
            tabId: TAB_ID,
            frameId: FRAME_ID,
            documentId: 'doc-1',
            collectStats: true,
            cssRules: expect.arrayContaining([
                expect.stringContaining('adguard'),
            ]),
        }));
        expect(insertCSSMock).toHaveBeenCalledTimes(1);
        expect(insertCSSMock).toHaveBeenCalledWith(expect.objectContaining({
            cssText: expect.stringContaining('--adguard-hit'),
            tabId: TAB_ID,
            frameId: FRAME_ID,
            documentId: 'doc-1',
        }));
    });

    it('does not answer a request for a document the frame context left', async () => {
        const frameContext = {
            documentId: 'doc-2',
            preparedCosmeticResult: {
                cssText: 'marked',
                areHitsStatsCollected: true,
            },
        };
        tabsApiMock.getFrameContext.mockReturnValue(frameContext);

        // The marked CSS cache belongs to the document the frame context
        // holds...
        await applyCss(TAB_ID, FRAME_ID, 'marked');
        insertCSSMock.mockClear();

        // ...while the request still comes from the previous one.
        const data = await CosmeticApi.reapplyMarkedCosmeticData(
            'https://example.org/',
            TAB_ID,
            FRAME_ID,
            'doc-1',
        );

        // Neither the cache hit of doc-2 nor an injection into the left
        // document may answer the request: the document that replaced it owns
        // the queue and the records.
        expect(executeExtCssMock).not.toHaveBeenCalled();
        expect(insertCSSMock).not.toHaveBeenCalled();
        expect(data.areNativeHitsStatsCollected).toBe(false);
        expect(data.extCssMarkersState).toBe(ExtCssMarkersState.NotRequired);
    });

    it('does not record the marked CSS state of a document the frame context left', async () => {
        // No marked CSS was injected into the frame context's document, so the
        // only source of a recorded state would be the re-apply below.
        tabsApiMock.getFrameContext.mockReturnValue({
            documentId: 'doc-2',
            preparedCosmeticResult: {
                cssText: 'unmarked',
                areHitsStatsCollected: false,
            },
        });

        const data = await CosmeticApi.reapplyMarkedCosmeticData(
            'https://example.org/',
            TAB_ID,
            FRAME_ID,
            'doc-1',
        );

        expect(insertCSSMock).not.toHaveBeenCalled();
        expect(data.areNativeHitsStatsCollected).toBe(false);

        // The skipped request describes doc-1, so the frame context of doc-2
        // keeps no record of it.
        const reported = CosmeticApi.getContentScriptData(
            'https://example.org/',
            TAB_ID,
            FRAME_ID,
        );
        expect(reported.areNativeHitsStatsCollected).toBe(false);
    });

    it('does not inject the marked CSS twice for the same prepared result', async () => {
        await CosmeticApi.reapplyMarkedCosmeticData('https://example.org/', TAB_ID, FRAME_ID);
        const data = await CosmeticApi.reapplyMarkedCosmeticData(
            'https://example.org/',
            TAB_ID,
            FRAME_ID,
        );

        expect(insertCSSMock).toHaveBeenCalledTimes(1);
        expect(data.areNativeHitsStatsCollected).toBe(true);
    });

    it('issues no injection on a second enable after both parts succeeded', async () => {
        const first = await CosmeticApi.reapplyMarkedCosmeticData(
            'https://example.org/',
            TAB_ID,
            FRAME_ID,
        );

        expect(first.extCssMarkersState).toBe(ExtCssMarkersState.Applied);
        expect(executeExtCssMock).toHaveBeenCalledTimes(1);
        expect(insertCSSMock).toHaveBeenCalledTimes(1);

        const second = await CosmeticApi.reapplyMarkedCosmeticData(
            'https://example.org/',
            TAB_ID,
            FRAME_ID,
        );

        expect(second.extCssMarkersState).toBe(ExtCssMarkersState.Applied);
        expect(executeExtCssMock).toHaveBeenCalledTimes(1);
        expect(insertCSSMock).toHaveBeenCalledTimes(1);
    });

    it('reports a failed ExtendedCss injection and retries it on the next enable', async () => {
        executeExtCssMock.mockRejectedValueOnce(new Error('injection failed'));
        const infoSpy = vi.spyOn(logger, 'info').mockImplementation(() => {});

        const failed = await CosmeticApi.reapplyMarkedCosmeticData(
            'https://example.org/',
            TAB_ID,
            FRAME_ID,
        );

        expect(failed.extCssMarkersState).toBe(ExtCssMarkersState.Failed);
        expect(failed.areNativeHitsStatsCollected).toBe(true);
        expect(executeExtCssMock).toHaveBeenCalledTimes(1);
        expect(insertCSSMock).toHaveBeenCalledTimes(1);

        const retried = await CosmeticApi.reapplyMarkedCosmeticData(
            'https://example.org/',
            TAB_ID,
            FRAME_ID,
        );

        // The cache is written only when both parts succeed, so the failed
        // ExtendedCss injection is retried on the next enable.
        expect(executeExtCssMock).toHaveBeenCalledTimes(2);
        expect(retried.extCssMarkersState).toBe(ExtCssMarkersState.Applied);
        // The marked native CSS of the first run is already in the document,
        // so the retry injects only the ExtendedCss part.
        expect(insertCSSMock).toHaveBeenCalledTimes(1);
        expect(infoSpy).toHaveBeenCalledTimes(1);
    });

    it('does not re-inject marked native CSS already in the document', async () => {
        executeExtCssMock.mockRejectedValueOnce(new Error('injection failed'));
        vi.spyOn(logger, 'info').mockImplementation(() => {});

        const first = await CosmeticApi.reapplyMarkedCosmeticData(
            'https://example.org/',
            TAB_ID,
            FRAME_ID,
        );

        expect(first.extCssMarkersState).toBe(ExtCssMarkersState.Failed);
        expect(first.areNativeHitsStatsCollected).toBe(true);
        expect(insertCSSMock).toHaveBeenCalledTimes(1);

        const second = await CosmeticApi.reapplyMarkedCosmeticData(
            'https://example.org/',
            TAB_ID,
            FRAME_ID,
        );

        // The first run left the native CSS in the document, so the retry
        // must not inject it again.
        expect(second.extCssMarkersState).toBe(ExtCssMarkersState.Applied);
        expect(second.areNativeHitsStatsCollected).toBe(true);
        expect(executeExtCssMock).toHaveBeenCalledTimes(2);
        expect(insertCSSMock).toHaveBeenCalledTimes(1);
    });

    it('writes the marked CSS cache when there is no native CSS to inject', async () => {
        cosmeticResult = new CosmeticResult();
        engineApiMock.matchCosmetic.mockReturnValue(cosmeticResult);
        tabsApiMock.getFrameContext.mockReturnValue({
            documentId: 'doc-1',
            preparedCosmeticResult: {
                cssText: undefined,
                areHitsStatsCollected: false,
            },
        });

        const first = await CosmeticApi.reapplyMarkedCosmeticData(
            'https://example.org/',
            TAB_ID,
            FRAME_ID,
        );

        expect(first.extCssMarkersState).toBe(ExtCssMarkersState.Applied);
        expect(first.areNativeHitsStatsCollected).toBe(true);
        expect(insertCSSMock).not.toHaveBeenCalled();
        expect(disposeExtCssMock).toHaveBeenCalledTimes(1);

        const second = await CosmeticApi.reapplyMarkedCosmeticData(
            'https://example.org/',
            TAB_ID,
            FRAME_ID,
        );

        // The no-native-CSS branch writes the cache, so the next enable is a
        // cache hit and issues no injection.
        expect(second.extCssMarkersState).toBe(ExtCssMarkersState.Applied);
        expect(disposeExtCssMock).toHaveBeenCalledTimes(1);
        expect(executeExtCssMock).not.toHaveBeenCalled();
    });

    it('reuses the initial marked CSS injection on reapply', async () => {
        tabsApiMock.getFrameContext.mockReturnValue({
            documentId: 'doc-1',
            preparedCosmeticResult: {
                cssText: 'marked',
                areHitsStatsCollected: true,
            },
        });

        await applyCss(TAB_ID, FRAME_ID, 'marked');
        const data = await CosmeticApi.reapplyMarkedCosmeticData(
            'https://example.org/',
            TAB_ID,
            FRAME_ID,
        );

        expect(insertCSSMock).toHaveBeenCalledTimes(1);
        expect(data.areNativeHitsStatsCollected).toBe(true);
    });

    it('retries a failed ExtendedCss injection on a marked CSS cache hit', async () => {
        const frameContext = makeMarkedExtCssFrameContext('doc-1');
        tabsApiMock.getFrameContext.mockReturnValue(frameContext);

        // The initial marked native CSS injection succeeds and writes the
        // cache before the floating ExtendedCss injection fails.
        await applyCss(TAB_ID, FRAME_ID, 'marked');

        executeExtCssMock.mockRejectedValue(new Error('injection failed'));
        vi.spyOn(logger, 'info').mockImplementation(() => {});
        await applyExtCssRules(frameContext);

        const data = await CosmeticApi.reapplyMarkedCosmeticData(
            'https://example.org/',
            TAB_ID,
            FRAME_ID,
        );

        // The failed ExtendedCss injection must not be reported as applied,
        // and the marked rules must be retried without re-injecting the
        // native CSS that is already in the document.
        expect(data.areNativeHitsStatsCollected).toBe(true);
        expect(data.extCssMarkersState).toBe(ExtCssMarkersState.Failed);
        expect(executeExtCssMock).toHaveBeenCalledTimes(2);
        expect(insertCSSMock).toHaveBeenCalledTimes(1);
    });

    it('applies marked ExtendedCss rules on a marked CSS cache hit after a failed injection', async () => {
        const frameContext = makeMarkedExtCssFrameContext('doc-1');
        tabsApiMock.getFrameContext.mockReturnValue(frameContext);

        await applyCss(TAB_ID, FRAME_ID, 'marked');

        executeExtCssMock.mockRejectedValueOnce(new Error('injection failed'));
        vi.spyOn(logger, 'info').mockImplementation(() => {});
        await applyExtCssRules(frameContext);

        const data = await CosmeticApi.reapplyMarkedCosmeticData(
            'https://example.org/',
            TAB_ID,
            FRAME_ID,
        );

        expect(data.areNativeHitsStatsCollected).toBe(true);
        expect(data.extCssMarkersState).toBe(ExtCssMarkersState.Applied);
        expect(executeExtCssMock).toHaveBeenCalledTimes(2);
        expect(insertCSSMock).toHaveBeenCalledTimes(1);

        // The successful retry is cached, so a later enable injects nothing.
        const second = await CosmeticApi.reapplyMarkedCosmeticData(
            'https://example.org/',
            TAB_ID,
            FRAME_ID,
        );

        expect(second.extCssMarkersState).toBe(ExtCssMarkersState.Applied);
        expect(executeExtCssMock).toHaveBeenCalledTimes(2);
        expect(insertCSSMock).toHaveBeenCalledTimes(1);
    });

    it('does not inject unmarked ExtendedCss rules after reapply', async () => {
        const frameContext = makeExtCssFrameContext('doc-1');
        tabsApiMock.getFrameContext.mockReturnValue(frameContext);

        // Collection is enabled on the open page: the marked rules replace the
        // unmarked instance of the same prepared result.
        await CosmeticApi.reapplyMarkedCosmeticData(
            'https://example.org/',
            TAB_ID,
            FRAME_ID,
        );

        expect(executeExtCssMock).toHaveBeenCalledTimes(1);

        // A later commit of the same document applies the prepared result
        // again, and its unmarked copy must not dispose the marked instance.
        await applyExtCssRules(frameContext);

        expect(executeExtCssMock).toHaveBeenCalledTimes(1);
    });

    it('does not inject marked CSS again when applyCss runs after reapply', async () => {
        tabsApiMock.getFrameContext.mockReturnValue({
            documentId: 'doc-1',
            preparedCosmeticResult: {
                cssText: 'marked',
                areHitsStatsCollected: true,
            },
        });

        await CosmeticApi.reapplyMarkedCosmeticData(
            'https://example.org/',
            TAB_ID,
            FRAME_ID,
        );
        await applyCss(TAB_ID, FRAME_ID, 'marked');

        expect(insertCSSMock).toHaveBeenCalledTimes(1);
    });

    it('deduplicates applyCss calls while the injection is in flight', async () => {
        tabsApiMock.getFrameContext.mockReturnValue({
            documentId: 'doc-1',
            preparedCosmeticResult: {
                cssText: 'marked',
                areHitsStatsCollected: true,
            },
        });

        let resolveInjection!: () => void;
        const injection = new Promise<void>((resolve) => {
            resolveInjection = resolve;
        });
        insertCSSMock.mockReturnValue(injection);

        const first = applyCss(TAB_ID, FRAME_ID, 'marked');
        const second = applyCss(TAB_ID, FRAME_ID, 'marked');

        await Promise.resolve();

        expect(insertCSSMock).toHaveBeenCalledTimes(1);

        resolveInjection();
        await Promise.all([first, second]);

        expect(insertCSSMock).toHaveBeenCalledTimes(1);
        expect(insertCSSMock.mock.calls[0][0].documentId).toBe('doc-1');
    });

    it('does not reuse the cache after a document change', async () => {
        const frameContext = {
            documentId: 'doc-1',
            preparedCosmeticResult: {
                cssText: 'marked',
                areHitsStatsCollected: true,
            },
        };
        tabsApiMock.getFrameContext.mockReturnValue(frameContext);

        await applyCss(TAB_ID, FRAME_ID, 'marked');
        frameContext.documentId = 'doc-2';
        await applyCss(TAB_ID, FRAME_ID, 'marked');

        expect(insertCSSMock).toHaveBeenCalledTimes(2);
        expect(insertCSSMock.mock.calls[0][0].documentId).toBe('doc-1');
        expect(insertCSSMock.mock.calls[1][0].documentId).toBe('doc-2');
    });

    it('reports native hits as collected when there is no native CSS', async () => {
        cosmeticResult = new CosmeticResult();
        engineApiMock.matchCosmetic.mockReturnValue(cosmeticResult);
        tabsApiMock.getFrameContext.mockReturnValue({
            preparedCosmeticResult: {
                cssText: undefined,
                areHitsStatsCollected: false,
            },
        });

        const data = await CosmeticApi.reapplyMarkedCosmeticData(
            'https://example.org/',
            TAB_ID,
            FRAME_ID,
        );

        expect(data.areNativeHitsStatsCollected).toBe(true);
        expect(insertCSSMock).not.toHaveBeenCalled();
    });

    it('does not inject marked CSS for an allowlisted document', async () => {
        tabsApiMock.getTabContext.mockReturnValue({
            info: { url: 'https://example.org/' },
            mainFrameRule: { isFilteringDisabled: (): boolean => true },
        });
        tabsApiMock.getFrameContext.mockReturnValue({
            preparedCosmeticResult: {
                cssText: 'unmarked-allowlisted',
                areHitsStatsCollected: false,
            },
        });

        const data = await CosmeticApi.reapplyMarkedCosmeticData(
            'https://example.org/',
            TAB_ID,
            FRAME_ID,
        );

        expect(data.areHitsStatsCollected).toBe(false);
        expect(data.areNativeHitsStatsCollected).toBe(false);
        expect(insertCSSMock).not.toHaveBeenCalled();
    });

    it('injects marked CSS and marked ExtendedCss rules without a frame context', async () => {
        tabsApiMock.getFrameContext.mockReturnValue(undefined);

        const data = await CosmeticApi.reapplyMarkedCosmeticData(
            'https://example.org/',
            TAB_ID,
            FRAME_ID,
        );

        expect(data.areHitsStatsCollected).toBe(true);
        expect(data.areNativeHitsStatsCollected).toBe(true);
        expect(data.extCssRules).toBeNull();
        expect(executeExtCssMock).toHaveBeenCalledTimes(1);
        expect(insertCSSMock).toHaveBeenCalledTimes(1);
        // No document id is known, so the injection falls back to the frame
        // target.
        expect(insertCSSMock.mock.calls[0][0].documentId).toBeUndefined();
    });

    it('stops retrying when the frame context changes', async () => {
        const frameContext = {
            preparedCosmeticResult: {
                cssText: 'marked',
                areHitsStatsCollected: true,
            },
        };
        const nextFrameContext = {
            preparedCosmeticResult: {
                cssText: 'next',
                areHitsStatsCollected: true,
            },
        };
        tabsApiMock.getFrameContext
            .mockReturnValueOnce(frameContext)
            .mockReturnValueOnce(frameContext)
            .mockReturnValue(nextFrameContext);
        insertCSSMock.mockRejectedValue(new Error('injection failed'));

        const data = await CosmeticApi.reapplyMarkedCosmeticData(
            'https://example.org/',
            TAB_ID,
            FRAME_ID,
        );

        expect(insertCSSMock).toHaveBeenCalledTimes(1);
        expect(data.areNativeHitsStatsCollected).toBe(false);
    });

    it('stops retrying when the frame navigates during the retry delay', async () => {
        vi.useFakeTimers();

        const frameContext = {
            documentId: 'doc-1',
            preparedCosmeticResult: {
                cssText: 'marked',
                areHitsStatsCollected: true,
            },
        };
        const nextFrameContext = {
            documentId: 'doc-2',
            preparedCosmeticResult: {
                cssText: 'next',
                areHitsStatsCollected: true,
            },
        };
        tabsApiMock.getFrameContext.mockReturnValue(frameContext);
        insertCSSMock.mockRejectedValue(new Error('injection failed'));

        const resultPromise = CosmeticApi.reapplyMarkedCosmeticData(
            'https://example.org/',
            TAB_ID,
            FRAME_ID,
        );

        await vi.advanceTimersByTimeAsync(0);
        tabsApiMock.getFrameContext.mockReturnValue(nextFrameContext);
        await vi.advanceTimersByTimeAsync(10);

        const data = await resultPromise;

        expect(insertCSSMock).toHaveBeenCalledTimes(1);
        expect(data.areNativeHitsStatsCollected).toBe(false);
    });

    it('stops retrying when the document of the frame context changes in place', async () => {
        vi.useFakeTimers();

        // A navigation mutates the frame context object instead of replacing
        // it, so the object identity alone cannot detect it.
        const frameContext = {
            documentId: 'doc-1',
            preparedCosmeticResult: {
                cssText: 'marked',
                areHitsStatsCollected: true,
            },
        };
        tabsApiMock.getFrameContext.mockReturnValue(frameContext);
        insertCSSMock.mockRejectedValue(new Error('injection failed'));

        const resultPromise = CosmeticApi.reapplyMarkedCosmeticData(
            'https://example.org/',
            TAB_ID,
            FRAME_ID,
        );

        await vi.advanceTimersByTimeAsync(0);
        frameContext.documentId = 'doc-2';
        await vi.advanceTimersByTimeAsync(10);

        const data = await resultPromise;

        expect(insertCSSMock).toHaveBeenCalledTimes(1);
        expect(insertCSSMock.mock.calls[0][0].documentId).toBe('doc-1');
        expect(data.areNativeHitsStatsCollected).toBe(false);
    });

    it('retries marked CSS injection after a transient failure', async () => {
        insertCSSMock
            .mockRejectedValueOnce(new Error('transient failure'))
            .mockResolvedValue(undefined);

        const data = await CosmeticApi.reapplyMarkedCosmeticData(
            'https://example.org/',
            TAB_ID,
            FRAME_ID,
        );

        expect(insertCSSMock).toHaveBeenCalledTimes(2);
        // The retry stays in the document the first attempt targeted.
        expect(insertCSSMock.mock.calls[0][0].documentId).toBe('doc-1');
        expect(insertCSSMock.mock.calls[1][0].documentId).toBe('doc-1');
        expect(data.areNativeHitsStatsCollected).toBe(true);
    });

    it('injects marked ExtendedCss rules when marked CSS injection fails', async () => {
        insertCSSMock.mockRejectedValue(new Error('injection failed'));
        const infoSpy = vi.spyOn(logger, 'info').mockImplementation(() => {});

        const data = await CosmeticApi.reapplyMarkedCosmeticData(
            'https://example.org/',
            TAB_ID,
            FRAME_ID,
        );

        expect(data.areHitsStatsCollected).toBe(true);
        expect(data.areNativeHitsStatsCollected).toBe(false);
        expect(data.extCssRules).toBeNull();
        expect(executeExtCssMock).toHaveBeenCalledTimes(1);
        expect(infoSpy).toHaveBeenCalledTimes(1);
    });

    it('waits for the pending ExtendedCss injection of the same document', async () => {
        const frameContext = makeExtCssFrameContext('doc-1');
        tabsApiMock.getFrameContext.mockReturnValue(frameContext);

        const { promise, resolve } = await startPendingExtCssInjection(frameContext);

        expect(executeExtCssMock).toHaveBeenCalledTimes(1);

        const reapplyPromise = CosmeticApi.reapplyMarkedCosmeticData(
            'https://example.org/',
            TAB_ID,
            FRAME_ID,
        );

        // Let the re-apply reach its injection step: it must stay blocked on
        // the initial one, which is still applying the unmarked rules to the
        // same document.
        await Promise.resolve();
        await Promise.resolve();

        expect(executeExtCssMock).toHaveBeenCalledTimes(1);

        resolve();
        await promise;

        const data = await reapplyPromise;

        expect(executeExtCssMock).toHaveBeenCalledTimes(2);
        expect(executeExtCssMock).toHaveBeenLastCalledWith(expect.objectContaining({
            documentId: 'doc-1',
            collectStats: true,
        }));
        expect(data.areHitsStatsCollected).toBe(true);
    });

    it('reports a pending marked ExtendedCss injection from a cache hit only after it settles', async () => {
        const frameContext = makeMarkedExtCssFrameContext('doc-1');
        tabsApiMock.getFrameContext.mockReturnValue(frameContext);

        // The marked native CSS is cached, but the marked ExtendedCss
        // injection it was prepared with is still in flight.
        await applyCss(TAB_ID, FRAME_ID, 'marked');
        insertCSSMock.mockClear();

        const { promise, resolve } = await startPendingExtCssInjection(frameContext);

        let reapplySettled = false;
        const reapply = CosmeticApi.reapplyMarkedCosmeticData(
            'https://example.org/',
            TAB_ID,
            FRAME_ID,
        ).then((result) => {
            reapplySettled = true;
            return result;
        });

        await Promise.resolve();
        await Promise.resolve();

        // The cache hit must not report the markers as applied while the
        // operation that carries them is still in flight.
        expect(reapplySettled).toBe(false);
        expect(executeExtCssMock).toHaveBeenCalledTimes(1);

        resolve();
        await promise;

        const data = await reapply;

        // The awaited operation applied the same prepared result, so the
        // re-apply must not replace it with a second one.
        expect(executeExtCssMock).toHaveBeenCalledTimes(1);
        expect(data.extCssMarkersState).toBe(ExtCssMarkersState.Applied);
        expect(data.areNativeHitsStatsCollected).toBe(true);
    });

    it('injects the marked rules when the pending cache hit operation fails', async () => {
        const frameContext = makeMarkedExtCssFrameContext('doc-1');
        tabsApiMock.getFrameContext.mockReturnValue(frameContext);
        vi.spyOn(logger, 'info').mockImplementation(() => {});

        await applyCss(TAB_ID, FRAME_ID, 'marked');
        insertCSSMock.mockClear();

        let rejectInjection!: (error: Error) => void;
        executeExtCssMock.mockImplementationOnce(() => new Promise<boolean>((_resolve, reject) => {
            rejectInjection = reject;
        }));
        const injection = applyExtCssRules(frameContext);

        const reapply = CosmeticApi.reapplyMarkedCosmeticData(
            'https://example.org/',
            TAB_ID,
            FRAME_ID,
        );

        await Promise.resolve();
        await Promise.resolve();

        expect(executeExtCssMock).toHaveBeenCalledTimes(1);

        rejectInjection(new Error('injection failed'));
        await injection;

        const data = await reapply;

        // A failed operation leaves no success record, so the marked rules are
        // injected and the real outcome is reported.
        expect(executeExtCssMock).toHaveBeenCalledTimes(2);
        expect(executeExtCssMock).toHaveBeenLastCalledWith(expect.objectContaining({
            documentId: 'doc-1',
            collectStats: true,
        }));
        expect(data.extCssMarkersState).toBe(ExtCssMarkersState.Applied);
        expect(data.areNativeHitsStatsCollected).toBe(true);
    });

    it('does not inject marked ExtendedCss rules that the pending injection already applied', async () => {
        const frameContext = makeExtCssFrameContext('doc-1');
        tabsApiMock.getFrameContext.mockReturnValue(frameContext);

        // The document was loaded with collection disabled, so its unmarked
        // rules were injected once.
        await applyExtCssRules(frameContext);
        expect(executeExtCssMock).toHaveBeenCalledTimes(1);

        // Collection is enabled: the frame context now holds a marked
        // prepared result, and its injection is still in flight.
        frameContext.preparedCosmeticResult = {
            cssText: 'marked',
            extCssRules: ['example.org#?#.banner:has(> .ad) { display: none !important; }'],
            areHitsStatsCollected: true,
        };
        const { promise, resolve } = await startPendingExtCssInjection(frameContext);

        const reapplyPromise = CosmeticApi.reapplyMarkedCosmeticData(
            'https://example.org/',
            TAB_ID,
            FRAME_ID,
        );

        // Let the re-apply reach the wait for the marked injection.
        await Promise.resolve();
        await Promise.resolve();

        expect(executeExtCssMock).toHaveBeenCalledTimes(2);

        resolve();
        await promise;

        const data = await reapplyPromise;

        // The awaited injection carried the markers of the same prepared
        // result, so the re-apply has nothing left to inject.
        expect(executeExtCssMock).toHaveBeenCalledTimes(2);
        expect(data.extCssMarkersState).toBe(ExtCssMarkersState.Applied);
        expect(data.areNativeHitsStatsCollected).toBe(true);
        expect(insertCSSMock).toHaveBeenCalledTimes(1);
    });

    it('does not inject marked rules when the document changes while waiting for the pending injection', async () => {
        const frameContext = makeExtCssFrameContext('doc-1');
        tabsApiMock.getFrameContext.mockReturnValue(frameContext);

        const { promise, resolve } = await startPendingExtCssInjection(frameContext);

        const reapplyPromise = CosmeticApi.reapplyMarkedCosmeticData(
            'https://example.org/',
            TAB_ID,
            FRAME_ID,
        );

        // Let the re-apply reach the wait for the initial injection.
        await Promise.resolve();
        await Promise.resolve();

        expect(executeExtCssMock).toHaveBeenCalledTimes(1);

        // The navigation mutates the live frame context in place, so the rules
        // matched for doc-1 must not be injected into doc-2.
        frameContext.documentId = 'doc-2';
        resolve();
        await promise;

        const data = await reapplyPromise;

        expect(executeExtCssMock).toHaveBeenCalledTimes(1);
        expect(insertCSSMock).not.toHaveBeenCalled();
        expect(data.areNativeHitsStatsCollected).toBe(false);
        expect(data.extCssMarkersState).toBe(ExtCssMarkersState.NotRequired);
    });

    it('stops the re-apply when the frame context already moved on', async () => {
        const frameContext = makeExtCssFrameContext('doc-1');
        tabsApiMock.getFrameContext.mockReturnValue(frameContext);

        const { promise, resolve } = await startPendingExtCssInjection(frameContext);

        // The frame context advanced to the next document while the unmarked
        // injection of the previous one is still in flight.
        frameContext.documentId = 'doc-2';

        const reapplyPromise = CosmeticApi.reapplyMarkedCosmeticData(
            'https://example.org/',
            TAB_ID,
            FRAME_ID,
            'doc-1',
        );

        // Let the re-apply reach the queue: it must stay blocked on the
        // operation of the requesting document instead of racing it.
        await Promise.resolve();
        await Promise.resolve();

        expect(executeExtCssMock).toHaveBeenCalledTimes(1);

        resolve();
        await promise;

        const data = await reapplyPromise;

        // The frame context no longer holds doc-1 after the wait, so the
        // marked rules are not injected and the queue entry of doc-2 is not
        // replaced by a stale operation.
        expect(executeExtCssMock).toHaveBeenCalledTimes(1);
        expect(data.areNativeHitsStatsCollected).toBe(false);
        expect(data.extCssMarkersState).toBe(ExtCssMarkersState.NotRequired);
    });

    it('does not report the marker state of another document when the frame context moved on', async () => {
        const frameContext = makeMarkedExtCssFrameContext('doc-1');
        tabsApiMock.getFrameContext.mockReturnValue(frameContext);

        // doc-1 holds its marked native CSS and its marked ExtendedCss rules.
        await applyCss(TAB_ID, FRAME_ID, 'marked');
        await applyExtCssRules(frameContext);

        // An ExtendedCss injection for doc-1 is still in flight when the frame
        // context advances to the next document.
        const { promise, resolve } = await startPendingExtCssInjection(frameContext);
        frameContext.documentId = 'doc-2';

        const reapplyPromise = CosmeticApi.reapplyMarkedCosmeticData(
            'https://example.org/',
            TAB_ID,
            FRAME_ID,
            'doc-1',
        );

        // Let the re-apply reach the wait for the doc-1 injection.
        await Promise.resolve();
        await Promise.resolve();

        expect(executeExtCssMock).toHaveBeenCalledTimes(2);

        // The navigation commits while the re-apply waits, so it injects
        // nothing.
        frameContext.documentId = 'doc-3';
        resolve();
        await promise;

        const data = await reapplyPromise;

        // The request describes doc-1, so the state recorded for the document
        // the frame context holds now must not be reported.
        expect(insertCSSMock).toHaveBeenCalledTimes(1);
        expect(data.areNativeHitsStatsCollected).toBe(false);
        expect(data.extCssMarkersState).toBe(ExtCssMarkersState.NotRequired);
    });

    it('does not wait for an ExtendedCss injection of another document', async () => {
        const frameContext = makeExtCssFrameContext('doc-1');
        tabsApiMock.getFrameContext.mockReturnValue(frameContext);

        const { promise, resolve } = await startPendingExtCssInjection(frameContext);

        // The frame navigated while the initial injection was in flight. The
        // pending injection belongs to the previous document and must not
        // block the re-apply of the current one.
        frameContext.documentId = 'doc-2';

        const data = await CosmeticApi.reapplyMarkedCosmeticData(
            'https://example.org/',
            TAB_ID,
            FRAME_ID,
        );

        expect(data.areHitsStatsCollected).toBe(true);
        expect(executeExtCssMock).toHaveBeenCalledTimes(2);
        expect(executeExtCssMock).toHaveBeenLastCalledWith(expect.objectContaining({
            documentId: 'doc-2',
        }));

        resolve();
        await promise;
    });

    it('does not start a second ExtendedCss injection for the same prepared result', async () => {
        const frameContext = makeExtCssFrameContext('doc-1');
        tabsApiMock.getFrameContext.mockReturnValue(frameContext);

        const { promise, resolve } = await startPendingExtCssInjection(frameContext);

        let secondSettled = false;
        const second = applyExtCssRules(frameContext).then(() => {
            secondSettled = true;
        });

        await Promise.resolve();
        await Promise.resolve();

        // The second operation waits instead of replacing the instance while
        // the first one is still applying.
        expect(secondSettled).toBe(false);
        expect(executeExtCssMock).toHaveBeenCalledTimes(1);

        resolve();
        await promise;
        await second;

        // The awaited operation applied the same prepared result, so the
        // second call injects nothing.
        expect(executeExtCssMock).toHaveBeenCalledTimes(1);
    });

    it('starts a different prepared result only after the pending injection settles', async () => {
        const frameContext = makeExtCssFrameContext('doc-1');
        tabsApiMock.getFrameContext.mockReturnValue(frameContext);

        const { promise, resolve } = await startPendingExtCssInjection(frameContext);

        // Collection is enabled while the unmarked injection is in flight, so
        // the frame context now holds a marked prepared result and the marked
        // rules must be injected after the pending one.
        frameContext.preparedCosmeticResult = {
            cssText: 'marked',
            extCssRules: ['example.org#?#.banner:has(> .ad) { display: none !important; }'],
            areHitsStatsCollected: true,
        };

        const second = applyExtCssRules(frameContext);

        await Promise.resolve();
        await Promise.resolve();

        expect(executeExtCssMock).toHaveBeenCalledTimes(1);

        resolve();
        await promise;
        await second;

        expect(executeExtCssMock).toHaveBeenCalledTimes(2);
        expect(executeExtCssMock).toHaveBeenLastCalledWith(expect.objectContaining({
            documentId: 'doc-1',
            collectStats: true,
        }));
    });

    it('does not replace the queue entry of the next document after a stale wait', async () => {
        const frameContext = makeExtCssFrameContext('doc-1');
        tabsApiMock.getFrameContext.mockReturnValue(frameContext);

        // A: the unmarked operation of doc-1 is in flight.
        const a = await startPendingExtCssInjection(frameContext);

        // B: a marked result arrives and queues behind A.
        frameContext.preparedCosmeticResult = {
            cssText: 'marked',
            extCssRules: ['example.org#?#.banner:has(> .ad) { display: none !important; }'],
            areHitsStatsCollected: true,
        };
        const b = applyExtCssRules(frameContext);

        await Promise.resolve();
        await Promise.resolve();

        expect(executeExtCssMock).toHaveBeenCalledTimes(1);

        // A navigation mutates the frame context in place, so it now describes
        // the next document.
        frameContext.documentId = 'doc-2';

        // C: doc-2 starts and occupies the queue entry.
        const c = await startPendingExtCssInjection(frameContext);

        // A settles: B must leave without starting for the stale doc-1 and
        // without overwriting C's entry.
        a.resolve();
        await a.promise;
        await b;

        expect(executeExtCssMock).toHaveBeenCalledTimes(2);
        expect(executeExtCssMock.mock.calls[1][0]).toEqual(expect.objectContaining({
            documentId: 'doc-2',
        }));

        // A doc-2 caller while C is in flight queues behind it instead of
        // starting a concurrent doc-2 operation.
        const d = applyExtCssRules(frameContext);

        await Promise.resolve();
        await Promise.resolve();

        expect(executeExtCssMock).toHaveBeenCalledTimes(2);

        c.resolve();
        await c.promise;
        await d;

        // D carried the same prepared result as C, so it injects nothing.
        expect(executeExtCssMock).toHaveBeenCalledTimes(2);
    });

    it('does not replace the tail of the current document with a stale request', async () => {
        const frameContext = makeExtCssFrameContext('doc-1');
        tabsApiMock.getFrameContext.mockReturnValue(frameContext);

        // A: the unmarked operation of doc-1 is in flight.
        const a = await startPendingExtCssInjection(frameContext);

        // The frame context advances to doc-2 and C occupies its queue tail.
        frameContext.documentId = 'doc-2';
        const c = await startPendingExtCssInjection(frameContext);

        // A stale request for doc-1 arrives while C is still in flight.
        const stale = await CosmeticApi.reapplyMarkedCosmeticData(
            'https://example.org/',
            TAB_ID,
            FRAME_ID,
            'doc-1',
        );

        // It must neither inject into the document it left nor replace C's
        // entry.
        expect(executeExtCssMock).toHaveBeenCalledTimes(2);
        expect(executeExtCssMock.mock.calls[1][0]).toEqual(expect.objectContaining({
            documentId: 'doc-2',
        }));
        expect(stale.extCssMarkersState).toBe(ExtCssMarkersState.NotRequired);
        expect(stale.areNativeHitsStatsCollected).toBe(false);

        // A doc-2 caller must queue behind C instead of starting beside it.
        const d = applyExtCssRules(frameContext);

        await Promise.resolve();
        await Promise.resolve();

        expect(executeExtCssMock).toHaveBeenCalledTimes(2);

        a.resolve();
        await a.promise;
        c.resolve();
        await c.promise;
        await d;

        expect(executeExtCssMock).toHaveBeenCalledTimes(2);
    });

    it('serializes the re-apply behind an in-flight ordinary operation', async () => {
        const getMaxConcurrency = trackExtCssConcurrency();
        const frameContext = makeExtCssFrameContext('doc-1');
        tabsApiMock.getFrameContext.mockReturnValue(frameContext);

        const apply = applyExtCssRules(frameContext);
        const reapply = CosmeticApi.reapplyMarkedCosmeticData(
            'https://example.org/',
            TAB_ID,
            FRAME_ID,
        );

        await Promise.all([apply, reapply]);

        expect(getMaxConcurrency()).toBe(1);
        expect(executeExtCssMock).toHaveBeenCalledTimes(2);
        // The marked payload replaces the unmarked instance last.
        expect(executeExtCssMock).toHaveBeenLastCalledWith(expect.objectContaining({
            documentId: 'doc-1',
            collectStats: true,
        }));
    });

    it('serializes the re-apply behind an operation with another prepared result', async () => {
        trackExtCssConcurrency();
        const frameContext = makeExtCssFrameContext('doc-1');
        tabsApiMock.getFrameContext.mockReturnValue(frameContext);

        // An unmarked operation is in flight for the document.
        const a = await startPendingExtCssInjection(frameContext);

        // The frame context now holds a marked result, so the re-apply below
        // no longer shares the prepared result of the operation in flight.
        frameContext.preparedCosmeticResult = {
            cssText: 'marked',
            extCssRules: ['.reapply-marked { display: none !important; }'],
            areHitsStatsCollected: true,
        };

        const reapply = CosmeticApi.reapplyMarkedCosmeticData(
            'https://example.org/',
            TAB_ID,
            FRAME_ID,
        );

        await Promise.resolve();
        await Promise.resolve();

        // The re-apply must wait even though the prepared result differs.
        expect(executeExtCssMock).toHaveBeenCalledTimes(1);

        a.resolve();
        await a.promise;

        const data = await reapply;

        expect(executeExtCssMock).toHaveBeenCalledTimes(2);
        expect(executeExtCssMock).toHaveBeenLastCalledWith(expect.objectContaining({
            documentId: 'doc-1',
            collectStats: true,
        }));
        expect(data.extCssMarkersState).toBe(ExtCssMarkersState.Applied);
    });

    it('does not overlap the re-apply with an operation that registers after the awaited one settled', async () => {
        const getMaxConcurrency = trackExtCssConcurrency();
        const frameContext = makeExtCssFrameContext('doc-1');
        tabsApiMock.getFrameContext.mockReturnValue(frameContext);

        // A: the unmarked operation is in flight.
        const a = await startPendingExtCssInjection(frameContext);

        // The re-apply queues behind A with the unmarked prepared result.
        const reapply = CosmeticApi.reapplyMarkedCosmeticData(
            'https://example.org/',
            TAB_ID,
            FRAME_ID,
        );

        // B: another prepared result queues behind A too. It registers its own
        // entry only after A settles.
        frameContext.preparedCosmeticResult = {
            cssText: 'marked',
            extCssRules: ['.b-marked { display: none !important; }'],
            areHitsStatsCollected: true,
        };
        const b = applyExtCssRules(frameContext);

        a.resolve();
        await a.promise;
        await b;
        await reapply;

        // The re-apply must queue behind B instead of running beside it.
        expect(getMaxConcurrency()).toBe(1);
        expect(executeExtCssMock).toHaveBeenCalledTimes(3);
        expect(executeExtCssMock).toHaveBeenLastCalledWith(expect.objectContaining({
            documentId: 'doc-1',
            cssRules: ['.b-marked { display: none !important; }'],
        }));
    });

    it('does not wait for an ExtendedCss injection of another document on apply', async () => {
        const frameContext = makeExtCssFrameContext('doc-1');
        tabsApiMock.getFrameContext.mockReturnValue(frameContext);

        const { promise, resolve } = await startPendingExtCssInjection(frameContext);

        // The navigation replaced the document in the same frame context, so
        // the pending injection of doc-1 must not block doc-2.
        frameContext.documentId = 'doc-2';

        await applyExtCssRules(frameContext);

        expect(executeExtCssMock).toHaveBeenCalledTimes(2);
        expect(executeExtCssMock).toHaveBeenLastCalledWith(expect.objectContaining({
            documentId: 'doc-2',
        }));

        resolve();
        await promise;
    });

    it('waits for the pending native CSS injection of the requesting document', async () => {
        const frameContext = {
            documentId: 'doc-1',
            preparedCosmeticResult: {
                cssText: 'marked',
                areHitsStatsCollected: true,
            },
        };
        tabsApiMock.getFrameContext.mockReturnValue(frameContext);

        let resolveInjection!: () => void;
        insertCSSMock.mockReturnValue(new Promise<void>((resolve) => {
            resolveInjection = resolve;
        }));

        const injection = applyCss(TAB_ID, FRAME_ID, 'marked');

        // The injection is recorded before it settles.
        await Promise.resolve();

        // The frame context advanced to the next document while the injection
        // of the previous one is still in flight.
        frameContext.documentId = 'doc-2';

        let settled = false;
        const wait = CosmeticApi.waitForPendingCssInjection(TAB_ID, FRAME_ID, 'doc-1')
            .then(() => {
                settled = true;
            });

        await Promise.resolve();
        await Promise.resolve();

        expect(settled).toBe(false);

        resolveInjection();
        await injection;
        await wait;

        expect(settled).toBe(true);
    });

    it('keeps ordinary cosmetic data non-blocking for the ExtendedCss injection', async () => {
        const frameContext = makeExtCssFrameContext('doc-1');
        tabsApiMock.getFrameContext.mockReturnValue(frameContext);

        const { promise, resolve } = await startPendingExtCssInjection(frameContext);

        await CosmeticApi.waitForPendingCssInjection(TAB_ID, FRAME_ID);

        const data = CosmeticApi.getContentScriptData(
            'https://example.org/',
            TAB_ID,
            FRAME_ID,
        );

        expect(data.areHitsStatsCollected).toBe(true);
        expect(data.extCssRules).toBeNull();
        expect(executeExtCssMock).toHaveBeenCalledTimes(1);

        resolve();
        await promise;
    });
});
