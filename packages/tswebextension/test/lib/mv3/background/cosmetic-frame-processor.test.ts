import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import { MAIN_FRAME_ID } from '../../../../src/lib/common/constants';
import { DocumentLifecycle } from '../../../../src/lib/common/interfaces';
import { appContext } from '../../../../src/lib/mv3/background/app-context';
import { CosmeticApi } from '../../../../src/lib/mv3/background/cosmetic-api';
import { CosmeticFrameProcessor } from '../../../../src/lib/mv3/background/cosmetic-frame-processor';
import { DocumentApi } from '../../../../src/lib/mv3/background/document-api';
import { engineApi } from '../../../../src/lib/mv3/background/engine-api';
import { tabsApi } from '../../../../src/lib/mv3/tabs/tabs-api';

vi.mock('../../../../src/lib/mv3/tabs/tabs-api', () => ({
    tabsApi: {
        resetBlockedRequestsCount: vi.fn(),
        setMainFrameRule: vi.fn(),
        updateFrameContext: vi.fn(),
        getFrameContext: vi.fn(),
        getByDocumentId: vi.fn(),
    },
}));

vi.mock('../../../../src/lib/mv3/background/document-api', () => ({
    DocumentApi: {
        matchFrame: vi.fn(),
    },
}));

vi.mock('../../../../src/lib/mv3/background/engine-api', () => ({
    engineApi: {
        matchRequest: vi.fn(),
        getCosmeticResult: vi.fn(),
        isLocalFilter: vi.fn(),
        isUserRulesFilter: vi.fn(),
    },
}));

vi.mock('../../../../src/lib/mv3/background/app-context', () => ({
    appContext: {
        configuration: {
            settings: {
                collectStats: false,
            },
        },
    },
}));

vi.mock('../../../../src/lib/mv3/background/cosmetic-api', () => ({
    CosmeticApi: {
        getCssText: vi.fn().mockReturnValue(''),
        getScriptsAndScriptletsData: vi.fn().mockReturnValue({ scriptText: '', scriptletDataList: [] }),
        getScriptText: vi.fn().mockReturnValue(''),
        getExtCssRules: vi.fn().mockReturnValue(['div:has(.ad) { display: none !important; }']),
    },
}));

vi.mock('../../../../src/lib/mv3/background/user-scripts-api', () => ({
    UserScriptsApi: {
        isEnabled: false,
    },
}));

describe('CosmeticFrameProcessor', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('handleFrame with prerender requests', () => {
        it('should NOT process main frame for prerender requests', () => {
            CosmeticFrameProcessor.handleFrame({
                tabId: 1,
                frameId: MAIN_FRAME_ID,
                parentFrameId: -1,
                url: 'https://example.com/',
                timeStamp: Date.now(),
                documentLifecycle: DocumentLifecycle.Prerender,
            });

            // For prerender requests, should NOT call any of these methods
            expect(vi.mocked(tabsApi.resetBlockedRequestsCount)).not.toHaveBeenCalled();
            expect(vi.mocked(tabsApi.setMainFrameRule)).not.toHaveBeenCalled();
            expect(vi.mocked(engineApi.matchRequest)).not.toHaveBeenCalled();
        });

        it('should process main frame for active requests', () => {
            vi.mocked(DocumentApi.matchFrame).mockReturnValue(null);
            vi.mocked(engineApi.matchRequest).mockReturnValue({
                getCosmeticOption: vi.fn().mockReturnValue(0),
            } as any);
            vi.mocked(engineApi.getCosmeticResult).mockReturnValue({
                elementHiding: { generic: [], specific: [] },
                CSS: { generic: [], specific: [] },
                getScriptRules: vi.fn().mockReturnValue([]),
            } as any);

            CosmeticFrameProcessor.handleFrame({
                tabId: 1,
                frameId: MAIN_FRAME_ID,
                parentFrameId: -1,
                url: 'https://example.com/',
                timeStamp: Date.now(),
                documentLifecycle: DocumentLifecycle.Active,
            });

            // For active requests, should call these methods
            expect(vi.mocked(tabsApi.resetBlockedRequestsCount)).toHaveBeenCalledWith(1);
            expect(vi.mocked(tabsApi.setMainFrameRule)).toHaveBeenCalled();
            expect(vi.mocked(engineApi.matchRequest)).toHaveBeenCalled();
        });

        it('should process main frame when documentLifecycle is undefined (older browsers)', () => {
            vi.mocked(DocumentApi.matchFrame).mockReturnValue(null);
            vi.mocked(engineApi.matchRequest).mockReturnValue({
                getCosmeticOption: vi.fn().mockReturnValue(0),
            } as any);
            vi.mocked(engineApi.getCosmeticResult).mockReturnValue({
                elementHiding: { generic: [], specific: [] },
                CSS: { generic: [], specific: [] },
                getScriptRules: vi.fn().mockReturnValue([]),
            } as any);

            CosmeticFrameProcessor.handleFrame({
                tabId: 1,
                frameId: MAIN_FRAME_ID,
                parentFrameId: -1,
                url: 'https://example.com/',
                timeStamp: Date.now(),
                // documentLifecycle is undefined (older browser)
            });

            // For undefined documentLifecycle (backward compatibility), should process normally
            expect(vi.mocked(tabsApi.resetBlockedRequestsCount)).toHaveBeenCalledWith(1);
            expect(vi.mocked(tabsApi.setMainFrameRule)).toHaveBeenCalled();
            expect(vi.mocked(engineApi.matchRequest)).toHaveBeenCalled();
        });

        it('should NOT reset blocked count or update frame for prerender main frame', () => {
            // Simulate a prerender request that would be detected as main frame
            CosmeticFrameProcessor.handleFrame({
                tabId: 1,
                frameId: MAIN_FRAME_ID,
                parentFrameId: -1,
                url: 'https://prerender-target.com/',
                timeStamp: Date.now(),
                documentLifecycle: DocumentLifecycle.Prerender,
            });

            // Verify no state changes happened that would affect the active tab
            expect(vi.mocked(tabsApi.resetBlockedRequestsCount)).not.toHaveBeenCalled();
            expect(vi.mocked(tabsApi.setMainFrameRule)).not.toHaveBeenCalled();
            expect(vi.mocked(tabsApi.updateFrameContext)).not.toHaveBeenCalled();
        });
    });

    describe('handleFrame with sub-frames', () => {
        it('should process sub-frames normally regardless of documentLifecycle', () => {
            vi.mocked(tabsApi.getFrameContext).mockReturnValue({
                frameRule: null,
                url: 'https://example.com/',
            } as any);
            vi.mocked(engineApi.matchRequest).mockReturnValue({
                getCosmeticOption: vi.fn().mockReturnValue(0),
            } as any);
            vi.mocked(engineApi.getCosmeticResult).mockReturnValue({
                elementHiding: { generic: [], specific: [] },
                CSS: { generic: [], specific: [] },
                getScriptRules: vi.fn().mockReturnValue([]),
            } as any);

            CosmeticFrameProcessor.handleFrame({
                tabId: 1,
                frameId: 1, // sub-frame
                parentFrameId: MAIN_FRAME_ID,
                url: 'https://sub.example.com/',
                timeStamp: Date.now(),
                documentLifecycle: DocumentLifecycle.Active,
            });

            // Sub-frames should be processed
            expect(vi.mocked(engineApi.matchRequest)).toHaveBeenCalled();
        });
    });

    describe('handleFrame resets blocked count for non-HTTP pages', () => {
        it('should reset blocked request count for non-HTTP main frame URLs (e.g. chrome://newtab)', () => {
            CosmeticFrameProcessor.handleFrame({
                tabId: 1,
                frameId: MAIN_FRAME_ID,
                parentFrameId: -1,
                url: 'chrome://newtab/',
                timeStamp: Date.now(),
            });

            expect(vi.mocked(tabsApi.resetBlockedRequestsCount)).toHaveBeenCalledWith(1);
            // Should not proceed with matching since it's not an HTTP request
            expect(vi.mocked(engineApi.matchRequest)).not.toHaveBeenCalled();
        });
    });

    describe('handleFrame with prefetch requests', () => {
        it('should NOT process main frame for prefetch requests', () => {
            CosmeticFrameProcessor.handleFrame({
                tabId: 1,
                frameId: MAIN_FRAME_ID,
                parentFrameId: -1,
                url: 'https://prefetch-target.com/',
                timeStamp: Date.now(),
                documentLifecycle: DocumentLifecycle.Active,
                isPrefetchRequest: true,
            });

            // For prefetch requests, should NOT call any of these methods
            expect(vi.mocked(tabsApi.resetBlockedRequestsCount)).not.toHaveBeenCalled();
            expect(vi.mocked(tabsApi.setMainFrameRule)).not.toHaveBeenCalled();
            expect(vi.mocked(engineApi.matchRequest)).not.toHaveBeenCalled();
            expect(vi.mocked(tabsApi.updateFrameContext)).not.toHaveBeenCalled();
        });

        it('should process main frame when isPrefetchRequest is false', () => {
            vi.mocked(DocumentApi.matchFrame).mockReturnValue(null);
            vi.mocked(engineApi.matchRequest).mockReturnValue({
                getCosmeticOption: vi.fn().mockReturnValue(0),
            } as any);
            vi.mocked(engineApi.getCosmeticResult).mockReturnValue({
                elementHiding: { generic: [], specific: [] },
                CSS: { generic: [], specific: [] },
                getScriptRules: vi.fn().mockReturnValue([]),
            } as any);

            CosmeticFrameProcessor.handleFrame({
                tabId: 1,
                frameId: MAIN_FRAME_ID,
                parentFrameId: -1,
                url: 'https://example.com/',
                timeStamp: Date.now(),
                documentLifecycle: DocumentLifecycle.Active,
                isPrefetchRequest: false,
            });

            expect(vi.mocked(tabsApi.resetBlockedRequestsCount)).toHaveBeenCalledWith(1);
            expect(vi.mocked(tabsApi.setMainFrameRule)).toHaveBeenCalled();
            expect(vi.mocked(engineApi.matchRequest)).toHaveBeenCalled();
        });

        it('should not apply isPrefetchRequest guard to sub-frames', () => {
            vi.mocked(tabsApi.getFrameContext).mockReturnValue({
                frameRule: null,
                url: 'https://example.com/',
            } as any);
            vi.mocked(engineApi.matchRequest).mockReturnValue({
                getCosmeticOption: vi.fn().mockReturnValue(0),
            } as any);
            vi.mocked(engineApi.getCosmeticResult).mockReturnValue({
                elementHiding: { generic: [], specific: [] },
                CSS: { generic: [], specific: [] },
                getScriptRules: vi.fn().mockReturnValue([]),
            } as any);

            CosmeticFrameProcessor.handleFrame({
                tabId: 1,
                frameId: 1, // sub-frame
                parentFrameId: MAIN_FRAME_ID,
                url: 'https://sub.example.com/',
                timeStamp: Date.now(),
                isPrefetchRequest: true,
            });

            // The prefetch early-return only applies to main frames,
            // so sub-frames should be processed regardless of the flag.
            expect(vi.mocked(engineApi.matchRequest)).toHaveBeenCalled();
        });
    });

    describe('prepareCosmeticResult extCssRules', () => {
        it('should populate extCssRules on the prepared cosmetic result for a main frame', () => {
            const extCssRules = ['div:has(.ad) { display: none !important; }'];

            vi.mocked(DocumentApi.matchFrame).mockReturnValue(null);
            vi.mocked(engineApi.matchRequest).mockReturnValue({
                getCosmeticOption: vi.fn().mockReturnValue(0),
            } as any);
            vi.mocked(engineApi.getCosmeticResult).mockReturnValue({
                elementHiding: { generic: [], specific: [] },
                CSS: { generic: [], specific: [] },
                getScriptRules: vi.fn().mockReturnValue([]),
            } as any);
            vi.mocked(CosmeticApi.getExtCssRules).mockReturnValue(extCssRules);

            CosmeticFrameProcessor.handleFrame({
                tabId: 1,
                frameId: MAIN_FRAME_ID,
                parentFrameId: -1,
                url: 'https://example.com/',
                timeStamp: Date.now(),
                documentLifecycle: DocumentLifecycle.Active,
            });

            // ExtCSS rules are computed without hits markers (CSS-hits reporting
            // is a later slice) and with isNativeHasSupported always true for MV3.
            expect(vi.mocked(CosmeticApi.getExtCssRules)).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    areHitsStatsCollected: false,
                    isNativeHasSupported: true,
                }),
            );

            // The computed extCssRules are stored on the prepared result that is
            // passed to the frame context for later background injection.
            expect(vi.mocked(tabsApi.updateFrameContext)).toHaveBeenCalledWith(
                1,
                MAIN_FRAME_ID,
                expect.objectContaining({
                    preparedCosmeticResult: expect.objectContaining({ extCssRules }),
                }),
            );
        });
    });

    describe('CosmeticFrameProcessor — CSS hits stats', () => {
        beforeEach(() => {
            vi.clearAllMocks();
            // Flip stats on for this suite.
            vi.mocked(appContext.configuration!.settings).collectStats = true;
        });

        afterEach(() => {
            vi.mocked(appContext.configuration!.settings).collectStats = false;
        });

        it('passes the real areHitsStatsCollected to getExtCssRules and stores it on the prepared result', () => {
            // Reuse the working main-frame mock setup so handleFrame reaches
            // getCosmeticResult / getExtCssRules (matchingResult must be truthy
            // and the cosmetic result must expose getScriptRules/elementHiding/CSS
            // or prepareCosmeticResult throws).
            vi.mocked(DocumentApi.matchFrame).mockReturnValue(null);
            vi.mocked(engineApi.matchRequest).mockReturnValue({
                getCosmeticOption: vi.fn().mockReturnValue(0),
            } as any);
            vi.mocked(engineApi.getCosmeticResult).mockReturnValue({
                elementHiding: { generic: [], specific: [] },
                CSS: { generic: [], specific: [] },
                getScriptRules: vi.fn().mockReturnValue([]),
            } as any);
            vi.mocked(CosmeticApi.getExtCssRules).mockReturnValue(['div:has(.ad) { display: none !important; }']);

            CosmeticFrameProcessor.handleFrame({
                tabId: 1,
                frameId: MAIN_FRAME_ID,
                parentFrameId: -1,
                url: 'https://example.com/',
                timeStamp: Date.now(),
                documentLifecycle: DocumentLifecycle.Active,
            });

            expect(CosmeticApi.getExtCssRules).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({ areHitsStatsCollected: true, isNativeHasSupported: true }),
            );

            // The prepared result carries the flag for the injection path.
            expect(vi.mocked(tabsApi.updateFrameContext)).toHaveBeenCalledWith(
                1,
                MAIN_FRAME_ID,
                expect.objectContaining({
                    preparedCosmeticResult: expect.objectContaining({ areHitsStatsCollected: true }),
                }),
            );
        });
    });
});
