import { getDomain } from 'tldts';
import { NetworkRuleOption, CSP_HEADER_NAME, RequestType } from '@adguard/tsurlfilter';

import { defaultFilteringLog, FilteringEventType } from '../../../common/filtering-log';
import { ContentType } from '../../../common/request-type';
import { nanoid } from '../../../common/utils/nanoid';
import { RequestBlockingApi } from '../request/request-blocking-api';
import { type RequestContext, requestContextStorage } from '../request/request-context-storage';
import { SessionRuleId, SessionRulesApi } from '../session-rules-api';
import { tabsApi } from '../../tabs/tabs-api';

/**
 * Content Security Policy Headers filtering service module.
 * 
 * This service blocks third-party CSP reports using Chrome's Declarative Net Request API.
 * 
 * **Important limitations:**
 * 
 * 1. **Does not work when filtering is disabled (paused):**
 *    - CSP blocking rule is removed when `filteringEnabled = false`
 *    - All session rules are cleared via `SessionRulesApi.removeAllSessionRules()`
 * 
 * 2. **Does not work for allowlisted domains:**
 *    - Allowlist rules create DNR `allow` rules with high priority
 *    - Chrome DNR prioritizes `allow` rules over `block` rules
 *    - CSP blocking (session rule) has lower priority than allowlist (dynamic rule)
 *    - This is correct behavior - allowlist should disable ALL filtering for the domain
 */
export class CspService {
    /**
     * Initializes the CSP report blocking service.
     */
    public static async init(): Promise<void> {
        await CspService.addCspReportBlockingRule();
    }

    /**
     * Adds a CSP report blocking rule to the declarative net request API.
     */
    public static async addCspReportBlockingRule(): Promise<void> {
        const rule: chrome.declarativeNetRequest.Rule = {
            id: SessionRuleId.CSPReportBlocking,
            action: {
                type: chrome.declarativeNetRequest.RuleActionType.BLOCK,
            },
            condition: {
                urlFilter: '*',
                resourceTypes: [chrome.declarativeNetRequest.ResourceType.CSP_REPORT],
                domainType: chrome.declarativeNetRequest.DomainType.THIRD_PARTY,
            },
        };

        await SessionRulesApi.setSessionRule(rule);
    }

    /**
     * Logs CSP report blocking events in onBeforeRequest.
     * Called for all requests to detect third-party CSP reports that will be blocked by DNR.
     *
     * @param context Request context.
     */
    public static onBeforeRequest(context: RequestContext): void {
        const {
            requestType, thirdParty, tabId, referrerUrl,
        } = context;

        if (requestType === RequestType.CspReport && thirdParty) {
            defaultFilteringLog.publishEvent({
                type: FilteringEventType.CspReportBlocked,
                data: {
                    eventId: context.eventId,
                    tabId: context.tabId,
                    cspReportBlocked: true,
                },
            });

            tabsApi.incrementTabBlockedRequestCount(tabId, referrerUrl);
        }
    }

    /**
     * Applies CSP rules to response headers and returns modified headers.
     * It is applied when webRequest.onHeadersReceived event is fired.
     *
     * @param context Request context.
     */
    public static onHeadersReceived(context: RequestContext): void {
        const {
            matchingResult,
            responseHeaders,
            requestId,
            tabId,
            requestUrl,
            referrerUrl,
        } = context;

        if (!matchingResult) {
            return;
        }

        const cspHeaders = [];

        const cspRules = matchingResult.getCspRules();

        for (let i = 0; i < cspRules.length; i += 1) {
            const rule = cspRules[i];
            if (rule.isOptionEnabled(NetworkRuleOption.Header)) {
                const responseHeaderMatch = rule.matchResponseHeaders(responseHeaders);
                if (!responseHeaderMatch || rule.isAllowlist()) {
                    continue;
                }
            }

            // Don't forget: getCspRules returns all $csp rules, we must directly check that the rule is blocking.
            if (RequestBlockingApi.isRequestBlockedByRule(rule)) {
                const cspHeaderValue = rule.getAdvancedModifierValue();

                if (cspHeaderValue) {
                    cspHeaders.push({
                        name: CSP_HEADER_NAME,
                        value: cspHeaderValue,
                    });
                }
            }

            defaultFilteringLog.publishEvent({
                type: FilteringEventType.ApplyCspRule,
                data: {
                    tabId,
                    eventId: nanoid(),
                    requestUrl,
                    frameUrl: referrerUrl,
                    frameDomain: getDomain(referrerUrl) as string,
                    requestType: ContentType.Csp,
                    filterId: rule.getFilterListId(),
                    ruleIndex: rule.getIndex(),
                    timestamp: Date.now(),
                    isAllowlist: rule.isAllowlist(),
                    isImportant: rule.isOptionEnabled(NetworkRuleOption.Important),
                    isDocumentLevel: rule.isDocumentLevelAllowlistRule(),
                    isCsp: rule.isOptionEnabled(NetworkRuleOption.Csp),
                    isCookie: rule.isOptionEnabled(NetworkRuleOption.Cookie),
                    advancedModifier: rule.getAdvancedModifierValue(),
                },
            });
        }

        if (cspHeaders.length > 0) {
            requestContextStorage.update(requestId, {
                responseHeaders: responseHeaders ? [...responseHeaders, ...cspHeaders] : cspHeaders,
            });
        }
    }
}
