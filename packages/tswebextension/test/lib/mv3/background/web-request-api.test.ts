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
        getFrameContext: vi.fn(),
        updateFrameContext: vi.fn(),
        getTabContext: vi.fn(),
        getTabFrameRule: vi.fn(),
        incrementTabBlockedRequestCount: vi.fn(),
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
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(CosmeticApi, 'applyCosmeticRules').mockResolvedValue([]);
    });

    it('recalculates cosmetics when a new document reuses the frame context', () => {
        // A new document can reuse the frame context of the previous one: the
        // precalculation is skipped for a speculative main-frame request, and
        // `shouldSkipRecalculation` skips a navigation whose URL and timestamp
        // match the stored context. Without the recalculation the previous
        // document's prepared rules are injected into the new document.
        vi.mocked(tabsApi.getFrameContext).mockReturnValue({
            url: 'https://previous.example/',
            documentId: 'previous-document-id',
            parentFrameId: 2,
        } as any);

        (WebRequestApi as any).onCommitted({
            tabId: 1,
            frameId: 0,
            parentFrameId: -1,
            documentId: 'activated-document-id',
            url: 'https://activated.example/',
            timeStamp: 456,
            documentLifecycle: DocumentLifecycle.Active,
        });

        expect(vi.mocked(tabsApi.updateFrameContext)).toHaveBeenCalledWith(1, 0, {
            documentId: 'activated-document-id',
            url: 'https://activated.example/',
            timeStamp: 456,
            preparedCosmeticResult: undefined,
            cosmeticResult: undefined,
            matchingResult: undefined,
        });
        expect(vi.mocked(CosmeticFrameProcessor.precalculateCosmetics)).toHaveBeenCalledWith(
            expect.objectContaining({
                tabId: 1,
                frameId: 0,
                url: 'https://activated.example/',
                // The committed event's parent frame id, not the stale one
                // stored in the reused frame context.
                parentFrameId: -1,
            }),
        );
    });

    it('recalculates cosmetics for a new document with the same URL', () => {
        // A new document with the same URL reuses the frame context too: the
        // URL is unchanged, but the document and its isolated world are not,
        // so the prepared result belongs to the previous document.
        vi.mocked(tabsApi.getFrameContext).mockReturnValue({
            url: 'https://example.com/',
            documentId: 'previous-document-id',
        } as any);

        (WebRequestApi as any).onCommitted({
            tabId: 1,
            frameId: 0,
            parentFrameId: -1,
            documentId: 'activated-document-id',
            url: 'https://example.com/',
            timeStamp: 456,
            documentLifecycle: DocumentLifecycle.Active,
        });

        expect(vi.mocked(tabsApi.updateFrameContext)).toHaveBeenCalledWith(1, 0, {
            documentId: 'activated-document-id',
            url: 'https://example.com/',
            timeStamp: 456,
            preparedCosmeticResult: undefined,
            cosmeticResult: undefined,
            matchingResult: undefined,
        });
        expect(vi.mocked(CosmeticFrameProcessor.precalculateCosmetics)).toHaveBeenCalled();
    });

    it('does not recalculate cosmetics for a background page', () => {
        // Cosmetics are never applied there, so the frame must not be
        // recalculated — for the main frame that would also reset the tab's
        // blocked request counter.
        vi.mocked(tabsApi.getFrameContext).mockReturnValue({
            url: 'https://example.com/',
            documentId: 'previous-document-id',
        } as any);

        (WebRequestApi as any).onCommitted({
            tabId: -1,
            frameId: 0,
            parentFrameId: -1,
            documentId: 'new-document-id',
            url: 'https://example.com/',
            timeStamp: 456,
            documentLifecycle: DocumentLifecycle.Active,
        });

        expect(vi.mocked(CosmeticFrameProcessor.precalculateCosmetics)).not.toHaveBeenCalled();
        expect(vi.mocked(CosmeticApi.applyCosmeticRules)).not.toHaveBeenCalled();
    });

    it('does not recalculate cosmetics for an assistant frame', () => {
        vi.mocked(tabsApi.getFrameContext).mockReturnValue({
            url: 'https://example.com/',
            documentId: 'previous-document-id',
        } as any);
        vi.mocked(tabsApi.getTabContext).mockReturnValue({
            assistantInitTimestamp: 1000,
            getFrameContext: () => ({ parentFrameId: 0 }),
        } as any);

        (WebRequestApi as any).onCommitted({
            tabId: 1,
            frameId: 2,
            parentFrameId: 0,
            documentId: 'new-document-id',
            url: 'about:blank',
            timeStamp: 1100,
            documentLifecycle: DocumentLifecycle.Active,
        });

        expect(vi.mocked(CosmeticFrameProcessor.precalculateCosmetics)).not.toHaveBeenCalled();
        expect(vi.mocked(CosmeticApi.applyCosmeticRules)).not.toHaveBeenCalled();
    });

    it('does not recalculate cosmetics for a same-document navigation', () => {
        // A same-document navigation keeps the document, so the prepared
        // result is still valid and the scriptlets must not be injected again.
        vi.mocked(tabsApi.getFrameContext).mockReturnValue({
            url: 'https://example.com/',
            documentId: 'document-id',
        } as any);

        (WebRequestApi as any).onCommitted({
            tabId: 1,
            frameId: 0,
            parentFrameId: -1,
            documentId: 'document-id',
            url: 'https://example.com/new-route',
            timeStamp: 456,
            documentLifecycle: DocumentLifecycle.Active,
        });

        expect(vi.mocked(CosmeticFrameProcessor.precalculateCosmetics)).not.toHaveBeenCalled();
    });

    it('does not recalculate cosmetics after an ordinary navigation', () => {
        // `onBeforeNavigate` leaves a frame context without a document id
        // (Chrome does not set one there), so committing that same navigation
        // must not be taken for a replaced document: the rules were already
        // prepared for it and the tab's blocked request counter must not be
        // reset again.
        vi.mocked(CosmeticFrameProcessor.shouldSkipRecalculation).mockReturnValueOnce(false);
        vi.mocked(tabsApi.getFrameContext).mockReturnValue({
            url: 'https://example.com/',
            parentFrameId: -1,
        } as any);

        (WebRequestApi as any).onBeforeNavigate({
            tabId: 1,
            frameId: 0,
            parentFrameId: -1,
            url: 'https://example.com/',
            timeStamp: 456,
            documentLifecycle: DocumentLifecycle.Active,
        });

        expect(vi.mocked(CosmeticFrameProcessor.precalculateCosmetics)).toHaveBeenCalledTimes(1);
        vi.mocked(CosmeticFrameProcessor.precalculateCosmetics).mockClear();

        (WebRequestApi as any).onCommitted({
            tabId: 1,
            frameId: 0,
            parentFrameId: -1,
            documentId: 'document-id',
            url: 'https://example.com/',
            timeStamp: 456,
            documentLifecycle: DocumentLifecycle.Active,
        });

        expect(vi.mocked(tabsApi.updateFrameContext)).toHaveBeenCalledWith(1, 0, {
            documentId: 'document-id',
        });
        expect(vi.mocked(CosmeticFrameProcessor.precalculateCosmetics)).not.toHaveBeenCalled();
    });

    it('ignores a prerender commit', () => {
        // A prerender commit arrives for the same tab and frame with a
        // different document id, but it belongs to a hidden document.
        // `handleFrame` skips its recalculation, so touching the frame context
        // here would drop the visible document's prepared state and leave the
        // page without cosmetics if the prerender is discarded.
        vi.mocked(tabsApi.getFrameContext).mockReturnValue({
            url: 'https://visible.example/',
            documentId: 'visible-document-id',
        } as any);

        (WebRequestApi as any).onCommitted({
            tabId: 1,
            frameId: 0,
            parentFrameId: -1,
            documentId: 'prerendered-document-id',
            url: 'https://prerendered.example/',
            timeStamp: 456,
            documentLifecycle: DocumentLifecycle.Prerender,
        });

        expect(vi.mocked(tabsApi.updateFrameContext)).not.toHaveBeenCalled();
        expect(vi.mocked(CosmeticFrameProcessor.precalculateCosmetics)).not.toHaveBeenCalled();
        expect(vi.mocked(CosmeticApi.applyCosmeticRules)).not.toHaveBeenCalled();
    });
});
