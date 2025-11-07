import {
    describe,
    expect,
    beforeEach,
    it,
    vi,
} from 'vitest';
import { RequestType } from '@adguard/tsurlfilter';

import { CspService } from '../../../../../src/lib/mv3/background/services/csp-service';
import { SessionRuleId, SessionRulesApi } from '../../../../../src/lib/mv3/background/session-rules-api';
import { defaultFilteringLog } from '../../../../../src/lib/common/filtering-log';
import { tabsApi } from '../../../../../src/lib/mv3/tabs/tabs-api';

vi.mock('../../../../../src/lib/common/filtering-log', () => ({
    defaultFilteringLog: {
        publishEvent: vi.fn(),
    },
    FilteringEventType: {
        CspReportBlocked: 'CspReportBlocked',
    },
}));

vi.mock('../../../../../src/lib/mv3/background/session-rules-api', () => ({
    SessionRulesApi: {
        setSessionRule: vi.fn(),
    },
    SessionRuleId: {
        CSPReportBlocking: 5,
    },
}));

vi.mock('../../../../../src/lib/mv3/tabs/tabs-api', () => ({
    tabsApi: {
        incrementTabBlockedRequestCount: vi.fn(),
    },
}));

// Mock chrome API
const mockDeclarativeNetRequest = {
    RuleActionType: {
        BLOCK: 'block',
    },
    ResourceType: {
        CSP_REPORT: 'csp_report',
    },
    DomainType: {
        THIRD_PARTY: 'thirdParty',
    },
};

// @ts-expect-error - Partial mock for testing
chrome.declarativeNetRequest = mockDeclarativeNetRequest;

describe('CspService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('init', () => {
        it('should add CSP report blocking rule', async () => {
            await CspService.addCspReportBlockingRule();

            expect(vi.mocked(SessionRulesApi.setSessionRule)).toHaveBeenCalledWith({
                id: SessionRuleId.CspReportBlocking,
                action: {
                    type: 'block',
                },
                condition: {
                    urlFilter: '*',
                    resourceTypes: ['csp_report'],
                    domainType: 'thirdParty',
                },
            });
        });
    });

    describe('onBeforeRequest', () => {
        it('should log CSP report blocking for third-party CSP reports', () => {
            const context = {
                eventId: 'test-event-id',
                tabId: 1,
                requestType: RequestType.CspReport,
                thirdParty: true,
                referrerUrl: 'https://example.com',
            } as any;

            CspService.onBeforeRequest(context);

            expect(vi.mocked(defaultFilteringLog.publishEvent)).toHaveBeenCalledWith({
                type: 'CspReportBlocked',
                data: {
                    eventId: 'test-event-id',
                    tabId: 1,
                    cspReportBlocked: true,
                },
            });

            expect(vi.mocked(tabsApi.incrementTabBlockedRequestCount)).toHaveBeenCalledWith(1, 'https://example.com');
        });

        it('should not log for first-party CSP reports', () => {
            const context = {
                eventId: 'test-event-id',
                tabId: 1,
                requestType: RequestType.CspReport,
                thirdParty: false,
            } as any;

            CspService.onBeforeRequest(context);

            expect(vi.mocked(defaultFilteringLog.publishEvent)).not.toHaveBeenCalled();
        });

        it('should not log for non-CSP report requests', () => {
            const context = {
                eventId: 'test-event-id',
                tabId: 1,
                requestType: RequestType.Document,
                thirdParty: true,
            } as any;

            CspService.onBeforeRequest(context);

            expect(vi.mocked(defaultFilteringLog.publishEvent)).not.toHaveBeenCalled();
        });
    });
});
