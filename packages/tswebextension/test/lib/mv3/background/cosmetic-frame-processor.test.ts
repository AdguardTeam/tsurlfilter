import {
    describe,
    expect,
    beforeEach,
    afterEach,
    it,
    vi,
} from 'vitest';

import { CosmeticFrameProcessor } from '../../../../src/lib/mv3/background/cosmetic-frame-processor';
import { DocumentLifecycle } from '../../../../src/lib/common/interfaces';
import { MAIN_FRAME_ID } from '../../../../src/lib/common/constants';
import { tabsApi } from '../../../../src/lib/mv3/tabs/tabs-api';
import { DocumentApi } from '../../../../src/lib/mv3/background/document-api';
import { engineApi } from '../../../../src/lib/mv3/background/engine-api';

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
});
