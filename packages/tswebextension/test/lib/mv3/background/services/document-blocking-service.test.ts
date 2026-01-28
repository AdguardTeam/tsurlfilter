import {
    describe,
    expect,
    beforeEach,
    afterEach,
    it,
    vi,
} from 'vitest';

import { createNetworkRule } from '../../../../helpers/rule-creator';
import { DocumentBlockingService } from '../../../../../src/lib/mv3/background/services/document-blocking-service';
import { tabsApi } from '../../../../../src/lib/mv3/tabs/tabs-api';
import { engineApi } from '../../../../../src/lib/mv3/background/engine-api';
import { type ConfigurationMV3 } from '../../../../../src/lib/mv3/background/configuration';

vi.mock('../../../../../src/lib/mv3/tabs/tabs-api', () => ({
    tabsApi: {
        getTabContext: vi.fn(),
        canShowExtensionPageInTab: vi.fn().mockReturnValue(true),
    },
}));

vi.mock('../../../../../src/lib/mv3/background/engine-api', () => ({
    engineApi: {
        getRuleText: vi.fn(),
        retrieveRuleText: vi.fn().mockReturnValue('||example.com^$document'),
    },
}));

vi.mock('../../../../../src/lib/common/filtering-log', () => ({
    defaultFilteringLog: {
        publishEvent: vi.fn(),
    },
    FilteringEventType: {
        ApplyBasicRule: 'ApplyBasicRule',
    },
}));

vi.mock('../../../../../src/lib/common/utils/logger', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
    },
}));

describe('DocumentBlockingService', () => {
    let documentBlockingService: DocumentBlockingService;

    const getConfigurationMv3Fixture = (): ConfigurationMV3 => ({
        staticFiltersIds: [1, 2],
        customFilters: [],
        allowlist: [],
        trustedDomains: [],
        userrules: { content: '' },
        verbose: false,
        filtersPath: '/filters',
        ruleSetsPath: '/rulesets',
        declarativeLogEnabled: false,
        settings: {
            filteringEnabled: true,
            collectStats: true,
            debugScriptlets: false,
            allowlistInverted: false,
            allowlistEnabled: false,
            documentBlockingPageUrl: 'chrome-extension://abc/blocking.html',
            assistantUrl: '/assistant-inject.js',
            stealthModeEnabled: false,
            gpcScriptUrl: '/gpc.js',
            hideDocumentReferrerScriptUrl: '/hide-referrer.js',
            stealth: {
                blockChromeClientData: false,
                hideReferrer: false,
                hideSearchQueries: false,
                sendDoNotTrack: false,
                blockWebRTC: false,
                selfDestructThirdPartyCookies: false,
                selfDestructThirdPartyCookiesTime: 0,
                selfDestructFirstPartyCookies: false,
                selfDestructFirstPartyCookiesTime: 0,
            },
        },
    });

    beforeEach(() => {
        documentBlockingService = new DocumentBlockingService(tabsApi, engineApi);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('should skip redirect for prerender requests', () => {
        const requestUrl = 'https://example.com/page';
        const mockNetworkRule = createNetworkRule('||example.com^$document', 0);

        const mockConfig = getConfigurationMv3Fixture();
        documentBlockingService.configure(mockConfig);

        const result = documentBlockingService.handleDocumentBlocking({
            tabId: 1,
            eventId: 'someEvent',
            rule: mockNetworkRule,
            referrerUrl: 'https://referrer.com',
            requestUrl,
            requestId: '123',
            isPrerenderRequest: true,
        });

        // For prerender requests, should return undefined (skip redirect)
        expect(result).toBeUndefined();
    });

    it('should call redirectToBlockingUrl for non-prerender requests', () => {
        const requestUrl = 'https://example.com/page';
        const mockNetworkRule = createNetworkRule('||example.com^$document', 0);

        const mockConfig = getConfigurationMv3Fixture();
        documentBlockingService.configure(mockConfig);

        // Spy on redirectToBlockingUrl to verify it's called for non-prerender requests
        const redirectSpy = vi.spyOn(documentBlockingService as any, 'redirectToBlockingUrl')
            .mockImplementation(() => {});

        documentBlockingService.handleDocumentBlocking({
            tabId: 1,
            eventId: 'someEvent',
            rule: mockNetworkRule,
            referrerUrl: 'https://referrer.com',
            requestUrl,
            requestId: '123',
            isPrerenderRequest: false,
        });

        // For non-prerender requests, redirectToBlockingUrl should be called
        expect(redirectSpy).toHaveBeenCalled();
        redirectSpy.mockRestore();
    });

    it('should skip redirect when documentBlockingPageUrl is not set', () => {
        const requestUrl = 'https://example.com/page';
        const mockNetworkRule = createNetworkRule('||example.com^$document', 0);

        const mockConfig: ConfigurationMV3 = {
            ...getConfigurationMv3Fixture(),
            settings: {
                ...getConfigurationMv3Fixture().settings,
                documentBlockingPageUrl: undefined,
            },
        };
        documentBlockingService.configure(mockConfig);

        const result = documentBlockingService.handleDocumentBlocking({
            tabId: 1,
            eventId: 'someEvent',
            rule: mockNetworkRule,
            referrerUrl: 'https://referrer.com',
            requestUrl,
            requestId: '123',
        });

        // Should return undefined when documentBlockingPageUrl is not set
        expect(result).toBeUndefined();
    });
});
