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
import { CosmeticApi } from '../../../../src/lib/mv3/background/cosmetic-api';
import { createCosmeticRule } from '../../../helpers/rule-creator';

const {
    appContextMock,
    tabsApiMock,
    engineApiMock,
    insertCSSMock,
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
    },
}));

vi.mock('../../../../src/lib/common/utils/create-frame-match-query', () => ({
    createFrameMatchQuery: (): Record<string, unknown> => ({}),
}));

describe('CosmeticApi.reapplyMarkedCosmeticData', () => {
    const TAB_ID = 1;
    const FRAME_ID = 0;

    let cosmeticResult: CosmeticResult;

    const { applyCss } = (CosmeticApi as unknown as {
        applyCss: (tabId: number, frameId: number, cssText: string) => Promise<void>;
    });

    beforeEach(() => {
        appContextMock.configuration.settings.collectStats = true;
        insertCSSMock.mockReset();
        insertCSSMock.mockResolvedValue(undefined);
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
            preparedCosmeticResult: {
                cssText: 'unmarked',
                areHitsStatsCollected: false,
            },
        });
    });

    afterEach(() => {
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

    it('injects marked native CSS and returns marked ExtendedCss rules', async () => {
        const data = await CosmeticApi.reapplyMarkedCosmeticData(
            'https://example.org/',
            TAB_ID,
            FRAME_ID,
        );

        expect(data.areHitsStatsCollected).toBe(true);
        expect(data.areNativeHitsStatsCollected).toBe(true);
        expect(data.extCssRules?.some((rule) => rule.includes('adguard'))).toBe(true);
        expect(insertCSSMock).toHaveBeenCalledTimes(1);
        expect(insertCSSMock).toHaveBeenCalledWith(expect.objectContaining({
            cssText: expect.stringContaining('--adguard-hit'),
            tabId: TAB_ID,
            frameId: FRAME_ID,
        }));
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

    it('injects marked CSS without a frame context and keeps marked ExtendedCss rules', async () => {
        tabsApiMock.getFrameContext.mockReturnValue(undefined);

        const data = await CosmeticApi.reapplyMarkedCosmeticData(
            'https://example.org/',
            TAB_ID,
            FRAME_ID,
        );

        expect(data.areHitsStatsCollected).toBe(true);
        expect(data.areNativeHitsStatsCollected).toBe(true);
        expect(data.extCssRules?.some((rule) => rule.includes('adguard'))).toBe(true);
        expect(insertCSSMock).toHaveBeenCalledTimes(1);
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
        expect(data.areNativeHitsStatsCollected).toBe(true);
    });

    it('keeps marked ExtendedCss rules when marked CSS injection fails', async () => {
        insertCSSMock.mockRejectedValue(new Error('injection failed'));
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
