import { defaultFilteringLog, FilteringEventType } from '../../../common/filtering-log';
import { type RequestContext } from '../request';
import { SessionRulesApi, SessionRuleId } from '../session-rules-api';

// FIXME add tests for this service

// FIXME consider cases
//  1. when whole filtering is disabled
//  2. when only one site filtering is disabled (allowlist, @@||example.com$document — general exception rules, )

/**
 * CSP report blocking service.
 */
export class CspReportBlockingService {
    /**
     * Initializes the CSP report blocking service.
     */
    static async init(): Promise<void> {
        await CspReportBlockingService.addCspReportBlockingRule();
    }

    /**
     * Adds a CSP report blocking rule to the declarative net request API.
     */
    static async addCspReportBlockingRule(): Promise<void> {
        const rule: chrome.declarativeNetRequest.Rule = {
            id: SessionRuleId.CSPReportBlocking,
            action: {
                type: chrome.declarativeNetRequest.RuleActionType.BLOCK,
            },
            condition: {
                urlFilter: '*',
                resourceTypes: [chrome.declarativeNetRequest.ResourceType.CSP_REPORT],
            },
        };

        await SessionRulesApi.setSessionRule(rule);
    }

    /**
     * Logs CSP report blocking event.
     *
     * @param context Request context.
     */
    static onCspReportBlocked(context: RequestContext): void {
        defaultFilteringLog.publishEvent({
            type: FilteringEventType.CspReportBlocked,
            data: {
                eventId: context.eventId,
                tabId: context.tabId,
                cspReportBlocked: true,
            },
        });
    }
}
