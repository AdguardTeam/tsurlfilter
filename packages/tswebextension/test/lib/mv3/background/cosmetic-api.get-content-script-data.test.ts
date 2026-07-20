import {
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import { CosmeticApi } from '../../../../src/lib/mv3/background/cosmetic-api';

// `vi.mock` factories are hoisted above top-level `const` declarations, so the
// mock functions must be created via `vi.hoisted` to be referenceable inside
// the factories and the test body alike.
const { matchCosmeticMock, getTabContextMock, appContextMock } = vi.hoisted(() => ({
    matchCosmeticMock: vi.fn(),
    getTabContextMock: vi.fn(),
    // Mutable so individual tests can toggle `collectStats`.
    appContextMock: {
        isStorageInitialized: true,
        isAppStarted: true,
        configuration: { settings: { collectStats: false } },
    },
}));

vi.mock('../../../../src/lib/mv3/background/app-context', () => ({
    appContext: appContextMock,
}));

vi.mock('../../../../src/lib/mv3/background/engine-api', () => ({
    engineApi: { matchCosmetic: matchCosmeticMock },
}));

vi.mock('../../../../src/lib/mv3/tabs/tabs-api', () => ({
    tabsApi: { getTabContext: getTabContextMock },
}));

vi.mock('../../../../src/lib/common/utils/create-frame-match-query', () => ({
    createFrameMatchQuery: vi.fn(() => ({})),
}));

describe('CosmeticApi.getContentScriptData (MV3) — ExtCSS removed from content script', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        matchCosmeticMock.mockReset();
        getTabContextMock.mockReset();
        matchCosmeticMock.mockReturnValue({});
        getTabContextMock.mockReturnValue({
            info: { url: 'https://example.com/' },
            mainFrameRule: null,
        });
        appContextMock.configuration.settings.collectStats = false;
        vi.spyOn(CosmeticApi, 'getNativeCssSelectors').mockReturnValue(['.native-sel']);
    });

    it('returns extCssRules: null and does NOT compute ExtCSS rules', () => {
        const extCssSpy = vi
            .spyOn(CosmeticApi, 'getExtCssRules')
            .mockReturnValue(['should-not-be-used']);

        const result = CosmeticApi.getContentScriptData('https://example.com/', 1, 0);

        expect(result.extCssRules).toBeNull();
        expect(extCssSpy).not.toHaveBeenCalled();
    });

    it('still returns native CSS selectors for content-script repair', () => {
        const result = CosmeticApi.getContentScriptData('https://example.com/', 1, 0);

        expect(result.nativeCssSelectors).toEqual(['.native-sel']);
    });
});

describe('CosmeticApi.getContentScriptData (MV3) — native CSS hits stats flag', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        matchCosmeticMock.mockReset();
        getTabContextMock.mockReset();
        matchCosmeticMock.mockReturnValue({});
        getTabContextMock.mockReturnValue({
            info: { url: 'https://example.com/' },
            mainFrameRule: null,
        });
        appContextMock.configuration.settings.collectStats = false;
        vi.spyOn(CosmeticApi, 'getNativeCssSelectors').mockReturnValue(['.native-sel']);
    });

    it('returns areHitsStatsCollected: true when collectStats is on and the document is not allowlisted', () => {
        appContextMock.configuration.settings.collectStats = true;

        const result = CosmeticApi.getContentScriptData('https://example.com/', 1, 0);

        expect(result.areHitsStatsCollected).toBe(true);
    });

    it('returns areHitsStatsCollected: false when collectStats is on but the document is allowlisted', () => {
        appContextMock.configuration.settings.collectStats = true;
        getTabContextMock.mockReturnValue({
            info: { url: 'https://example.com/' },
            mainFrameRule: { isFilteringDisabled: () => true },
        });

        const result = CosmeticApi.getContentScriptData('https://example.com/', 1, 0);

        expect(result.areHitsStatsCollected).toBe(false);
    });

    it('returns areHitsStatsCollected: false when collectStats is off', () => {
        appContextMock.configuration.settings.collectStats = false;

        const result = CosmeticApi.getContentScriptData('https://example.com/', 1, 0);

        expect(result.areHitsStatsCollected).toBe(false);
    });
});
