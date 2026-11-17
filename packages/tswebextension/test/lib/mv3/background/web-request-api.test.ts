import {
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import { HTTPMethod, RequestType } from '@adguard/tsurlfilter';

import { defaultFilteringLog } from '../../../../src/lib/common/filtering-log';
import { DocumentLifecycle } from '../../../../src/lib/common/interfaces';
import { ContentType } from '../../../../src/lib/common/request-type';
import { CosmeticApi } from '../../../../src/lib/mv3/background/cosmetic-api';
import { CosmeticFrameProcessor } from '../../../../src/lib/mv3/background/cosmetic-frame-processor';
import { engineApi } from '../../../../src/lib/mv3/background/engine-api';
import { RequestBlockingApi } from '../../../../src/lib/mv3/background/request/request-blocking-api';
import { requestContextStorage } from '../../../../src/lib/mv3/background/request/request-context-storage';
import { documentBlockingService } from '../../../../src/lib/mv3/background/services/document-blocking-service';
import {
    removeParamInjectionService,
} from '../../../../src/lib/mv3/background/services/remove-param-injection-service';
import { WebRequestApi } from '../../../../src/lib/mv3/background/web-request-api';
import { tabsApi } from '../../../../src/lib/mv3/tabs/tabs-api';

vi.mock('../../../../src/lib/common/filtering-log', () => ({
    defaultFilteringLog: {
        publishEvent: vi.fn(),
    },
    FilteringEventType: {
        SendRequest: 'SendRequest',
        ApplyBasicRule: 'ApplyBasicRule',
    },
}));

vi.mock('../../../../src/lib/common/utils/rule-text-provider', () => ({
    getRuleTexts: vi.fn(() => ({
        appliedRuleText: '||example.com^$document',
        originalRuleText: '||example.com^$document',
    })),
}));

vi.mock('../../../../src/lib/common/companies-db-service', () => ({
    companiesDbService: {
        match: vi.fn(() => null),
    },
}));

vi.mock('../../../../src/lib/mv3/background/services/csp-service', () => ({
    CspService: {
        onBeforeRequest: vi.fn(),
    },
}));

vi.mock('../../../../src/lib/mv3/tabs/tabs-api', () => ({
    tabsApi: {
        createTabContextIfNotExists: vi.fn(),
        setFrameContext: vi.fn(),
        updateFrameContext: vi.fn(),
        getTabContext: vi.fn(() => undefined),
        getTabFrameRule: vi.fn(),
        incrementTabBlockedRequestCount: vi.fn(),
    },
}));

vi.mock('../../../../src/lib/mv3/background/cosmetic-api', () => ({
    CosmeticApi: {
        shouldApplyCosmetics: vi.fn(() => true),
        applyCosmeticRules: vi.fn(() => Promise.resolve([])),
    },
}));

vi.mock('../../../../src/lib/mv3/background/engine-api', () => ({
    engineApi: {
        matchRequest: vi.fn(() => null),
    },
}));

vi.mock('../../../../src/lib/mv3/background/document-api', () => ({
    DocumentApi: {
        matchFrame: vi.fn(() => null),
    },
}));

vi.mock('../../../../src/lib/mv3/background/cosmetic-frame-processor', () => ({
    CosmeticFrameProcessor: {
        shouldSkipRecalculation: vi.fn(() => true),
        precalculateCosmetics: vi.fn(),
    },
}));

vi.mock('../../../../src/lib/mv3/background/request/request-blocking-api', () => ({
    RequestBlockingApi: {
        getBlockingResponse: vi.fn(() => undefined),
    },
}));

vi.mock('../../../../src/lib/mv3/background/request/request-context-storage', () => ({
    requestContextStorage: {
        update: vi.fn(),
        get: vi.fn(),
        delete: vi.fn(),
    },
}));

vi.mock('../../../../src/lib/mv3/background/services/document-blocking-service', () => ({
    documentBlockingService: {
        handleDocumentBlocking: vi.fn(),
    },
}));

vi.mock('../../../../src/lib/mv3/background/services/remove-param-injection-service', () => ({
    removeParamInjectionService: {
        invalidateTab: vi.fn(),
        injectRemoveParam: vi.fn(),
    },
}));

describe('WebRequestApi MV3 prefetch handling', () => {
    const createBeforeRequestContext = (): {
        requestType: RequestType;
        requestUrl: string;
        referrerUrl: string;
        requestId: string;
        method: HTTPMethod;
        tabId: number;
        frameId: number;
        eventId: string;
        contentType: ContentType;
        timestamp: number;
        thirdParty: boolean;
        isPrefetchRequest: boolean;
    } => ({
        requestType: RequestType.Document,
        requestUrl: 'https://example.com/',
        referrerUrl: 'https://example.com/',
        requestId: 'request-id',
        method: HTTPMethod.GET,
        tabId: 1,
        frameId: 0,
        eventId: 'event-id',
        contentType: ContentType.Document,
        timestamp: 123,
        thirdParty: false,
        isPrefetchRequest: false,
    });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('keeps isPrefetchRequest set in context for prefetch main-frame requests', () => {
        const context = createBeforeRequestContext();
        context.isPrefetchRequest = true;

        (WebRequestApi as any).onBeforeRequest({
            context,
            details: {
                parentFrameId: -1,
                documentLifecycle: DocumentLifecycle.Active,
                documentId: 'document-id',
            },
        });

        // isPrefetchRequest is already set in context by request-events layer
        expect(context.isPrefetchRequest).toBe(true);
    });

    it('marks context with isPrefetchRequest=false for prerender requests with documentId', () => {
        const context = createBeforeRequestContext();

        (WebRequestApi as any).onBeforeRequest({
            context,
            details: {
                parentFrameId: -1,
                documentLifecycle: DocumentLifecycle.Prerender,
                documentId: 'document-id',
            },
        });

        expect(context.isPrefetchRequest).toBe(false);
    });

    it('marks context with isPrefetchRequest=false for requests without documentId', () => {
        const context = createBeforeRequestContext();

        (WebRequestApi as any).onBeforeRequest({
            context,
            details: {
                parentFrameId: -1,
                documentLifecycle: DocumentLifecycle.Active,
            },
        });

        expect(context.isPrefetchRequest).toBe(false);
    });

    it('propagates isPrefetchRequest to document blocking on blocked main-frame requests', () => {
        const documentRule = {
            getFilterListId: vi.fn(() => 1),
            getIndex: vi.fn(() => 2),
            isAllowlist: vi.fn(() => false),
            isOptionEnabled: vi.fn(() => false),
            isDocumentLevelAllowlistRule: vi.fn(() => false),
            getAdvancedModifierValue: vi.fn(() => null),
        };
        const matchingResult = {
            getBasicResult: vi.fn(() => documentRule),
            getDocumentBlockingResult: vi.fn(() => documentRule),
        };

        vi.mocked(requestContextStorage.get).mockReturnValue({
            eventId: 'event-id',
            requestUrl: 'https://example.com/',
            referrerUrl: 'https://referrer.example/',
            contentType: ContentType.Document,
            matchingResult,
            isPrefetchRequest: true,
        } as any);

        (WebRequestApi as any).onErrorOccurred({
            details: {
                tabId: 1,
                requestId: 'request-id',
                url: 'https://example.com/',
                type: 'main_frame',
                error: 'net::ERR_BLOCKED_BY_CLIENT',
                documentLifecycle: DocumentLifecycle.Active,
            },
        });

        expect(vi.mocked(defaultFilteringLog.publishEvent)).toHaveBeenCalled();
        expect(vi.mocked(documentBlockingService.handleDocumentBlocking)).toHaveBeenCalledWith({
            eventId: 'event-id',
            requestUrl: 'https://example.com/',
            requestId: 'request-id',
            referrerUrl: 'https://referrer.example/',
            rule: documentRule,
            tabId: 1,
            isPrerenderRequest: false,
            isPrefetchRequest: true,
        });
    });

    it('does not reset frame context or recalculate cosmetics for prefetch main-frame requests', () => {
        // Even if recalculation would not be skipped, a speculative
        // (prefetch) main-frame request must not touch the frame's cosmetic
        // state, otherwise the subsequent real navigation gets deduplicated and
        // loses its prepared cosmetic result (AdguardBrowserExtension#3537).
        vi.mocked(CosmeticFrameProcessor.shouldSkipRecalculation).mockReturnValueOnce(false);
        vi.mocked(engineApi.matchRequest).mockReturnValueOnce({
            getBasicResult: vi.fn(() => null),
            getPopupRule: vi.fn(() => null),
        } as any);

        const context = createBeforeRequestContext();
        context.isPrefetchRequest = true;

        (WebRequestApi as any).onBeforeRequest({
            context,
            details: {
                parentFrameId: -1,
                documentLifecycle: DocumentLifecycle.Active,
                documentId: 'document-id',
                parentDocumentId: undefined,
            },
        });

        expect(vi.mocked(CosmeticFrameProcessor.precalculateCosmetics)).not.toHaveBeenCalled();
        expect(vi.mocked(tabsApi.setFrameContext)).not.toHaveBeenCalled();
        // shouldSkipRecalculation must not even be consulted for speculative
        // main-frame requests.
        expect(vi.mocked(CosmeticFrameProcessor.shouldSkipRecalculation)).not.toHaveBeenCalled();
    });

    it('does not reset frame context or recalculate cosmetics for prerender main-frame navigations', () => {
        // Same hazard as prefetch in onBeforeRequest: handleFrame skips
        // cosmetic recalculation for prerenders, so resetting the frame here
        // would poison the frame state for the subsequent real navigation
        // (AdguardBrowserExtension#3537).
        vi.mocked(CosmeticFrameProcessor.shouldSkipRecalculation).mockReturnValueOnce(false);

        (WebRequestApi as any).onBeforeNavigate({
            tabId: 1,
            frameId: 0,
            parentFrameId: -1,
            url: 'https://example.com/',
            timeStamp: 123,
            documentLifecycle: DocumentLifecycle.Prerender,
            documentId: 'document-id',
            parentDocumentId: undefined,
        });

        expect(vi.mocked(tabsApi.setFrameContext)).not.toHaveBeenCalled();
        expect(vi.mocked(CosmeticFrameProcessor.precalculateCosmetics)).not.toHaveBeenCalled();
        expect(vi.mocked(removeParamInjectionService.invalidateTab)).not.toHaveBeenCalled();
    });

    it('resets frame context and recalculates cosmetics for active main-frame navigations', () => {
        vi.mocked(CosmeticFrameProcessor.shouldSkipRecalculation).mockReturnValueOnce(false);

        (WebRequestApi as any).onBeforeNavigate({
            tabId: 1,
            frameId: 0,
            parentFrameId: -1,
            url: 'https://example.com/',
            timeStamp: 123,
            documentLifecycle: DocumentLifecycle.Active,
            documentId: 'document-id',
            parentDocumentId: undefined,
        });

        expect(vi.mocked(tabsApi.setFrameContext)).toHaveBeenCalled();
        expect(vi.mocked(CosmeticFrameProcessor.precalculateCosmetics)).toHaveBeenCalled();
        expect(vi.mocked(removeParamInjectionService.invalidateTab)).toHaveBeenCalledWith(1);
    });

    it('calls incrementTabBlockedRequestCount when blocking response is cancel', () => {
        vi.mocked(CosmeticFrameProcessor.shouldSkipRecalculation).mockReturnValueOnce(true);
        vi.mocked(engineApi.matchRequest).mockReturnValueOnce({
            getBasicResult: vi.fn(() => ({})),
            getPopupRule: vi.fn(() => null),
        } as any);
        vi.mocked(RequestBlockingApi.getBlockingResponse).mockReturnValueOnce({ cancel: true });

        const context = createBeforeRequestContext();

        (WebRequestApi as any).onBeforeRequest({
            context,
            details: {
                parentFrameId: -1,
                documentLifecycle: DocumentLifecycle.Active,
            },
        });

        expect(vi.mocked(tabsApi.incrementTabBlockedRequestCount)).toHaveBeenCalledWith(
            expect.objectContaining({
                tabId: 1,
            }),
        );
    });
});

describe('WebRequestApi MV3 onCommitted', () => {
    const COMMITTED_URL = 'https://example.com/?utm_source=spec';

    /**
     * Creates navigation details delivered by `webNavigation.onCommitted`.
     *
     * @param documentLifecycle Document lifecycle of the committed document.
     *
     * @returns Navigation event details.
     */
    const createOnCommittedDetails = (
        documentLifecycle: DocumentLifecycle,
    ): chrome.webNavigation.WebNavigationFramedCallbackDetails => ({
        tabId: 1,
        frameId: 0,
        frameType: 'outermost_frame' as chrome.webNavigation.WebNavigationFramedCallbackDetails['frameType'],
        url: COMMITTED_URL,
        documentId: 'document-id',
        documentLifecycle,
        timeStamp: 123,
        processId: 1,
    });

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(CosmeticApi.shouldApplyCosmetics).mockReturnValue(true);
        vi.mocked(CosmeticApi.applyCosmeticRules).mockResolvedValue([]);
    });

    it('does not inject $removeparam for a prerendered document', () => {
        // A prerendered document is loaded speculatively, e.g. while the user
        // pastes a URL into the address bar, and may never be shown. The
        // injection service publishes a filtering log event for every applied
        // rule, so injecting here logs a `$removeparam` rule for a page the
        // user never opened (AG-58004).
        (WebRequestApi as any).onCommitted(createOnCommittedDetails(DocumentLifecycle.Prerender));

        expect(vi.mocked(removeParamInjectionService.injectRemoveParam)).not.toHaveBeenCalled();
    });

    it('injects $removeparam when a prerendered document is activated', () => {
        // The same document is committed again with the `active` lifecycle
        // when the prerendered page is shown, so the rules are applied and
        // logged at that point.
        (WebRequestApi as any).onCommitted(createOnCommittedDetails(DocumentLifecycle.Active));

        expect(vi.mocked(removeParamInjectionService.injectRemoveParam)).toHaveBeenCalledWith(
            1,
            0,
            COMMITTED_URL,
        );
    });

    it('still applies cosmetic rules for a prerendered document', () => {
        (WebRequestApi as any).onCommitted(createOnCommittedDetails(DocumentLifecycle.Prerender));

        expect(vi.mocked(CosmeticApi.applyCosmeticRules)).toHaveBeenCalledWith(1, 0, true);
    });
});
