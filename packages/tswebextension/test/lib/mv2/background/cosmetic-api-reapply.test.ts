import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import { CosmeticResult } from '@adguard/tsurlfilter';

import { logger } from '../../../../src/lib/common/utils/logger';
import { CosmeticApi } from '../../../../src/lib/mv2/background/cosmetic-api';
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

    let cosmeticResult: CosmeticResult;

    beforeEach(() => {
        appContextMock.configuration.settings.collectStats = true;
        tabsApiMock.getTabContext.mockReset();
        tabsApiMock.getFrameContext.mockReset();
        tabsApiMock.getTabContext.mockReturnValue({
            info: { url: 'https://example.org/' },
            mainFrameRule: { isFilteringDisabled: (): boolean => false },
        });

        cosmeticResult = new CosmeticResult();
        cosmeticResult.elementHiding.append(createCosmeticRule('example.org##.banner', 0, 0));
        cosmeticResult.elementHiding.append(createCosmeticRule('example.org#?#.banner:has(> .ad)', 0, 1));
        engineApiMock.matchCosmetic.mockReset();
        engineApiMock.matchCosmetic.mockReturnValue(cosmeticResult);

        tabsApiMock.getFrameContext.mockReturnValue({
            documentId: 'doc-1',
            cosmeticResult,
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
        expect(data.extCssRules?.some((rule) => rule.includes('adguard'))).toBe(true);
    });

    it('reports prepared markers after initial injection succeeds', async () => {
        tabsApiMock.getFrameContext.mockReturnValue({
            cosmeticResult,
            preparedCosmeticResult: {
                cssText: 'marked',
                areHitsStatsCollected: true,
            },
        });
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
        tabsApiMock.getFrameContext.mockReturnValue({
            cosmeticResult,
            preparedCosmeticResult: {
                cssText: 'marked',
                areHitsStatsCollected: true,
            },
        });
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

    it('injects marked native CSS and returns marked ExtendedCss rules', async () => {
        const injectSpy = vi.spyOn(CosmeticApi, 'injectCss').mockResolvedValue();

        const data = await CosmeticApi.reapplyMarkedCosmeticData(
            'https://example.org/',
            TAB_ID,
            FRAME_ID,
        );

        expect(data.areHitsStatsCollected).toBe(true);
        expect(data.areNativeHitsStatsCollected).toBe(true);
        expect(data.extCssRules?.some((rule) => rule.includes('adguard'))).toBe(true);
        expect(injectSpy).toHaveBeenCalledTimes(1);

        const cssText = injectSpy.mock.calls[0][2];
        expect(cssText).toContain('--adguard-hit');
    });

    it('does not inject the marked CSS twice for the same prepared result', async () => {
        const injectSpy = vi.spyOn(CosmeticApi, 'injectCss').mockResolvedValue();

        await CosmeticApi.reapplyMarkedCosmeticData('https://example.org/', TAB_ID, FRAME_ID);
        const data = await CosmeticApi.reapplyMarkedCosmeticData(
            'https://example.org/',
            TAB_ID,
            FRAME_ID,
        );

        expect(injectSpy).toHaveBeenCalledTimes(1);
        expect(data.areNativeHitsStatsCollected).toBe(true);
    });

    it('reuses the initial marked CSS injection on reapply', async () => {
        tabsApiMock.getFrameContext.mockReturnValue({
            documentId: 'doc-1',
            cosmeticResult,
            preparedCosmeticResult: {
                cssText: 'marked',
                areHitsStatsCollected: true,
            },
        });
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
        tabsApiMock.getFrameContext.mockReturnValue({
            documentId: 'doc-1',
            cosmeticResult,
            preparedCosmeticResult: {
                cssText: 'marked',
                areHitsStatsCollected: true,
            },
        });
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
        tabsApiMock.getFrameContext.mockReturnValue({
            documentId: 'doc-1',
            cosmeticResult,
            preparedCosmeticResult: {
                cssText: 'marked',
                areHitsStatsCollected: true,
            },
        });

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
        const frameContext = {
            documentId: 'doc-1',
            cosmeticResult,
            preparedCosmeticResult: {
                cssText: 'marked',
                areHitsStatsCollected: true,
            },
        };
        tabsApiMock.getFrameContext.mockReturnValue(frameContext);
        const injectSpy = vi.spyOn(CosmeticApi, 'injectCss').mockResolvedValue();

        await CosmeticApi.applyCss(TAB_ID, FRAME_ID);
        frameContext.documentId = 'doc-2';
        await CosmeticApi.applyCss(TAB_ID, FRAME_ID);

        expect(injectSpy).toHaveBeenCalledTimes(2);
    });

    it('does not use the cache with a synthetic document id', async () => {
        const frameContext = {
            tabId: TAB_ID,
            frameId: FRAME_ID,
            documentId: `${TAB_ID}-${FRAME_ID}`,
            cosmeticResult,
            preparedCosmeticResult: {
                cssText: 'marked',
                areHitsStatsCollected: true,
            },
        };
        tabsApiMock.getFrameContext.mockReturnValue(frameContext);
        const injectSpy = vi.spyOn(CosmeticApi, 'injectCss').mockResolvedValue();

        await CosmeticApi.applyCss(TAB_ID, FRAME_ID);
        await CosmeticApi.applyCss(TAB_ID, FRAME_ID);

        expect(injectSpy).toHaveBeenCalledTimes(2);
    });

    it('reports native hits as collected when there is no native CSS', async () => {
        cosmeticResult = new CosmeticResult();
        tabsApiMock.getFrameContext.mockReturnValue({
            cosmeticResult,
            preparedCosmeticResult: {
                cssText: undefined,
                areHitsStatsCollected: false,
            },
        });
        const injectSpy = vi.spyOn(CosmeticApi, 'injectCss').mockResolvedValue();

        const data = await CosmeticApi.reapplyMarkedCosmeticData(
            'https://example.org/',
            TAB_ID,
            FRAME_ID,
        );

        expect(data.areNativeHitsStatsCollected).toBe(true);
        expect(injectSpy).not.toHaveBeenCalled();
    });

    it('does not inject marked CSS for an allowlisted document', async () => {
        tabsApiMock.getTabContext.mockReturnValue({
            info: { url: 'https://example.org/' },
            mainFrameRule: { isFilteringDisabled: (): boolean => true },
        });
        tabsApiMock.getFrameContext.mockReturnValue({
            cosmeticResult,
            preparedCosmeticResult: {
                cssText: 'unmarked-allowlisted',
                areHitsStatsCollected: false,
            },
        });
        const injectSpy = vi.spyOn(CosmeticApi, 'injectCss').mockResolvedValue();

        const data = await CosmeticApi.reapplyMarkedCosmeticData(
            'https://example.org/',
            TAB_ID,
            FRAME_ID,
        );

        expect(data.areHitsStatsCollected).toBe(false);
        expect(data.areNativeHitsStatsCollected).toBe(false);
        expect(injectSpy).not.toHaveBeenCalled();
    });

    it('injects marked CSS without a frame context and keeps marked ExtendedCss rules', async () => {
        tabsApiMock.getFrameContext.mockReturnValue(undefined);
        const injectSpy = vi.spyOn(CosmeticApi, 'injectCss').mockResolvedValue();

        const data = await CosmeticApi.reapplyMarkedCosmeticData(
            'https://example.org/',
            TAB_ID,
            FRAME_ID,
        );

        expect(data.areHitsStatsCollected).toBe(true);
        expect(data.areNativeHitsStatsCollected).toBe(true);
        expect(data.extCssRules?.some((rule) => rule.includes('adguard'))).toBe(true);
        expect(injectSpy).toHaveBeenCalledTimes(1);
    });

    it('stops retrying when the frame context changes', async () => {
        const frameContext = {
            cosmeticResult,
            preparedCosmeticResult: {
                cssText: 'marked',
                areHitsStatsCollected: true,
            },
        };
        const nextFrameContext = {
            cosmeticResult: new CosmeticResult(),
            preparedCosmeticResult: {
                cssText: 'next',
                areHitsStatsCollected: true,
            },
        };
        tabsApiMock.getFrameContext
            .mockReturnValueOnce(frameContext)
            .mockReturnValueOnce(frameContext)
            .mockReturnValue(nextFrameContext);
        const injectSpy = vi.spyOn(CosmeticApi, 'injectCss')
            .mockRejectedValue(new Error('injection failed'));

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

        const frameContext = {
            documentId: 'doc-1',
            cosmeticResult,
            preparedCosmeticResult: {
                cssText: 'marked',
                areHitsStatsCollected: true,
            },
        };
        const nextFrameContext = {
            documentId: 'doc-2',
            cosmeticResult: new CosmeticResult(),
            preparedCosmeticResult: {
                cssText: 'next',
                areHitsStatsCollected: true,
            },
        };
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

        const frameContext = {
            documentId: 'doc-1',
            cosmeticResult,
            preparedCosmeticResult: {
                cssText: 'marked',
                areHitsStatsCollected: true,
            },
        };
        const nextFrameContext = {
            documentId: 'doc-2',
            cosmeticResult: new CosmeticResult(),
            preparedCosmeticResult: {
                cssText: 'next',
                areHitsStatsCollected: true,
            },
        };
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

    it('keeps marked ExtendedCss rules when marked CSS injection fails', async () => {
        vi.spyOn(CosmeticApi, 'injectCss').mockRejectedValue(new Error('injection failed'));
        const infoSpy = vi.spyOn(logger, 'info').mockImplementation(() => {});

        const data = await CosmeticApi.reapplyMarkedCosmeticData(
            'https://example.org/',
            TAB_ID,
            FRAME_ID,
        );

        expect(data.areHitsStatsCollected).toBe(true);
        expect(data.areNativeHitsStatsCollected).toBe(false);
        expect(data.extCssRules?.some((rule) => rule.includes('adguard'))).toBe(true);
        expect(infoSpy).toHaveBeenCalledTimes(1);
    });
});
