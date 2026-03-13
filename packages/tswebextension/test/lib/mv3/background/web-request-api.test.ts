import {
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';
import { HTTPMethod, RequestType } from '@adguard/tsurlfilter';

import { ContentType } from '../../../../src/lib/common/request-type';
import { DocumentLifecycle } from '../../../../src/lib/common/interfaces';
import { defaultFilteringLog } from '../../../../src/lib/common/filtering-log';
import { WebRequestApi } from '../../../../src/lib/mv3/background/web-request-api';
import { documentBlockingService } from '../../../../src/lib/mv3/background/services/document-blocking-service';
import { requestContextStorage } from '../../../../src/lib/mv3/background/request/request-context-storage';

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
    });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('marks document requests with documentId as prefetch requests', () => {
        const context = createBeforeRequestContext();

        (WebRequestApi as any).onBeforeRequest({
            context,
            details: {
                parentFrameId: -1,
                documentLifecycle: DocumentLifecycle.Active,
                documentId: 'document-id',
            },
        });

        expect(vi.mocked(requestContextStorage.update)).toHaveBeenCalledWith('request-id', {
            isPrefetchRequest: true,
        });
    });

    it('does not mark prerender document requests with documentId as prefetch requests', () => {
        const context = createBeforeRequestContext();

        (WebRequestApi as any).onBeforeRequest({
            context,
            details: {
                parentFrameId: -1,
                documentLifecycle: DocumentLifecycle.Prerender,
                documentId: 'document-id',
            },
        });

        expect(vi.mocked(requestContextStorage.update)).toHaveBeenCalledWith('request-id', {
            isPrefetchRequest: false,
        });
    });

    it('does not mark document requests without documentId as prefetch requests', () => {
        const context = createBeforeRequestContext();

        (WebRequestApi as any).onBeforeRequest({
            context,
            details: {
                parentFrameId: -1,
                documentLifecycle: DocumentLifecycle.Active,
            },
        });

        expect(vi.mocked(requestContextStorage.update)).toHaveBeenCalledWith('request-id', {
            isPrefetchRequest: false,
        });
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
});
