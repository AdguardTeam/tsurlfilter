import {
    describe,
    expect,
    beforeEach,
    afterEach,
    it,
    vi,
} from 'vitest';

import { DocumentLifecycle } from '../../../../src/lib/common/interfaces';
import { MAIN_FRAME_ID } from '../../../../src/lib/common/constants';
import { CosmeticFrameProcessor } from '../../../../src/lib/mv2/background/cosmetic-frame-processor';
import { documentApi } from '../../../../src/lib/mv2/background/api';

vi.mock('../../../../src/lib/mv2/background/api', () => ({
    documentApi: {
        matchFrame: vi.fn(),
    },
    stealthApi: {
        getStealthScript: vi.fn().mockReturnValue(''),
    },
    tabsApi: {},
    engineApi: {},
    cosmeticFrameProcessor: {},
    documentBlockingService: {},
}));

vi.mock('../../../../src/lib/mv2/background/app-context', () => ({
    appContext: {
        configuration: {
            settings: {
                collectStats: false,
            },
        },
    },
}));

vi.mock('../../../../src/lib/mv2/background/cosmetic-api', () => ({
    CosmeticApi: {
        getCssText: vi.fn().mockReturnValue(''),
        getScriptsAndScriptletsData: vi.fn().mockReturnValue({ scriptText: '' }),
    },
}));

describe('CosmeticFrameProcessor', () => {
    let cosmeticFrameProcessor: CosmeticFrameProcessor;
    let mockTabsApi: any;
    let mockEngineApi: any;

    beforeEach(() => {
        vi.clearAllMocks();

        mockTabsApi = {
            resetBlockedRequestsCount: vi.fn(),
            setMainFrameRule: vi.fn(),
            updateFrameContext: vi.fn(),
            getFrameContext: vi.fn(),
            getByDocumentId: vi.fn(),
        };

        mockEngineApi = {
            matchRequest: vi.fn(),
            getCosmeticResult: vi.fn(),
        };

        vi.mocked(documentApi.matchFrame).mockReturnValue(null);

        cosmeticFrameProcessor = new CosmeticFrameProcessor(mockEngineApi, mockTabsApi);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('handleFrame with prerender requests', () => {
        it('should NOT process main frame for prerender requests', () => {
            cosmeticFrameProcessor.handleFrame({
                tabId: 1,
                frameId: MAIN_FRAME_ID,
                parentFrameId: -1,
                url: 'https://example.com/',
                timeStamp: Date.now(),
                documentLifecycle: DocumentLifecycle.Prerender,
            });

            // For prerender requests, should NOT call any of these methods
            expect(mockTabsApi.resetBlockedRequestsCount).not.toHaveBeenCalled();
            expect(mockTabsApi.setMainFrameRule).not.toHaveBeenCalled();
            expect(mockEngineApi.matchRequest).not.toHaveBeenCalled();
        });

        it('should process main frame for active requests', () => {
            mockEngineApi.matchRequest.mockReturnValue({
                getCosmeticOption: vi.fn().mockReturnValue(0),
            });
            mockEngineApi.getCosmeticResult.mockReturnValue({
                elementHiding: { generic: [], specific: [] },
                CSS: { generic: [], specific: [] },
                getScriptRules: vi.fn().mockReturnValue([]),
            });

            cosmeticFrameProcessor.handleFrame({
                tabId: 1,
                frameId: MAIN_FRAME_ID,
                parentFrameId: -1,
                url: 'https://example.com/',
                timeStamp: Date.now(),
                documentLifecycle: DocumentLifecycle.Active,
            });

            // For active requests, should call these methods
            expect(mockTabsApi.resetBlockedRequestsCount).toHaveBeenCalledWith(1);
            expect(mockTabsApi.setMainFrameRule).toHaveBeenCalled();
            expect(mockEngineApi.matchRequest).toHaveBeenCalled();
        });

        it('should process main frame when documentLifecycle is undefined (older browsers)', () => {
            mockEngineApi.matchRequest.mockReturnValue({
                getCosmeticOption: vi.fn().mockReturnValue(0),
            });
            mockEngineApi.getCosmeticResult.mockReturnValue({
                elementHiding: { generic: [], specific: [] },
                CSS: { generic: [], specific: [] },
                getScriptRules: vi.fn().mockReturnValue([]),
            });

            cosmeticFrameProcessor.handleFrame({
                tabId: 1,
                frameId: MAIN_FRAME_ID,
                parentFrameId: -1,
                url: 'https://example.com/',
                timeStamp: Date.now(),
                // documentLifecycle is undefined (older browser)
            });

            // For undefined documentLifecycle (backward compatibility), should process normally
            expect(mockTabsApi.resetBlockedRequestsCount).toHaveBeenCalledWith(1);
            expect(mockTabsApi.setMainFrameRule).toHaveBeenCalled();
            expect(mockEngineApi.matchRequest).toHaveBeenCalled();
        });

        it('should NOT reset blocked count or update frame for prerender main frame', () => {
            // Simulate a prerender request that would be detected as main frame
            cosmeticFrameProcessor.handleFrame({
                tabId: 1,
                frameId: MAIN_FRAME_ID,
                parentFrameId: -1,
                url: 'https://prerender-target.com/',
                timeStamp: Date.now(),
                documentLifecycle: DocumentLifecycle.Prerender,
            });

            // Verify no state changes happened that would affect the active tab
            expect(mockTabsApi.resetBlockedRequestsCount).not.toHaveBeenCalled();
            expect(mockTabsApi.setMainFrameRule).not.toHaveBeenCalled();
            expect(mockTabsApi.updateFrameContext).not.toHaveBeenCalled();
        });
    });

    describe('handleFrame with sub-frames', () => {
        it('should process sub-frames normally regardless of documentLifecycle', () => {
            mockTabsApi.getFrameContext.mockReturnValue({
                frameRule: null,
                url: 'https://example.com/',
            });
            mockEngineApi.matchRequest.mockReturnValue({
                getCosmeticOption: vi.fn().mockReturnValue(0),
            });
            mockEngineApi.getCosmeticResult.mockReturnValue({
                elementHiding: { generic: [], specific: [] },
                CSS: { generic: [], specific: [] },
                getScriptRules: vi.fn().mockReturnValue([]),
            });

            cosmeticFrameProcessor.handleFrame({
                tabId: 1,
                frameId: 1, // sub-frame
                parentFrameId: MAIN_FRAME_ID,
                url: 'https://sub.example.com/',
                timeStamp: Date.now(),
                documentLifecycle: DocumentLifecycle.Active,
            });

            // Sub-frames should be processed
            expect(mockEngineApi.matchRequest).toHaveBeenCalled();
        });
    });
});
