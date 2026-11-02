import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import { CosmeticResult } from '@adguard/tsurlfilter';

import { CosmeticApi } from '../../../../src/lib/mv2/background/cosmetic-api';
import { createCosmeticRule } from '../../../helpers/rule-creator';

const { appContextMock, tabsApiMock } = vi.hoisted(() => ({
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
}));

vi.mock('../../../../src/lib/mv2/background/app-context', () => ({
    appContext: appContextMock,
}));

vi.mock('../../../../src/lib/mv2/background/api', () => ({
    engineApi: {
        matchCosmetic: vi.fn(),
    },
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

        tabsApiMock.getFrameContext.mockReturnValue({
            cosmeticResult,
            preparedCosmeticResult: { cssText: 'unmarked' },
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('injects marked native CSS and returns marked ExtendedCss rules', async () => {
        const injectSpy = vi.spyOn(CosmeticApi, 'injectCss').mockResolvedValue();

        const data = await CosmeticApi.reapplyMarkedCosmeticData(
            'https://example.org/',
            TAB_ID,
            FRAME_ID,
        );

        expect(data.areHitsStatsCollected).toBe(true);
        expect(data.extCssRules?.some((rule) => rule.includes('adguard'))).toBe(true);
        expect(injectSpy).toHaveBeenCalledTimes(1);

        const cssText = injectSpy.mock.calls[0][2];
        expect(cssText).toContain('--adguard-hit');
    });

    it('does not inject the marked CSS twice for the same prepared result', async () => {
        const injectSpy = vi.spyOn(CosmeticApi, 'injectCss').mockResolvedValue();

        await CosmeticApi.reapplyMarkedCosmeticData('https://example.org/', TAB_ID, FRAME_ID);
        await CosmeticApi.reapplyMarkedCosmeticData('https://example.org/', TAB_ID, FRAME_ID);

        expect(injectSpy).toHaveBeenCalledTimes(1);
    });

    it('does not inject marked CSS for an allowlisted document', async () => {
        tabsApiMock.getTabContext.mockReturnValue({
            info: { url: 'https://example.org/' },
            mainFrameRule: { isFilteringDisabled: (): boolean => true },
        });
        tabsApiMock.getFrameContext.mockReturnValue({
            cosmeticResult,
            preparedCosmeticResult: { cssText: 'unmarked-allowlisted' },
        });
        const injectSpy = vi.spyOn(CosmeticApi, 'injectCss').mockResolvedValue();

        const data = await CosmeticApi.reapplyMarkedCosmeticData(
            'https://example.org/',
            TAB_ID,
            FRAME_ID,
        );

        expect(data.areHitsStatsCollected).toBe(false);
        expect(injectSpy).not.toHaveBeenCalled();
    });
});
