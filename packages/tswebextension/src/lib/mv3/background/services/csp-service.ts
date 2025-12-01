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
 * @note **Does not work for allowlisted domains:**
 *    - Allowlist rules have higher priority than CSP blocking rules
 *    - This is correct behavior - allowlist should disable ALL filtering for the domain
 *    - @see {@link https://adguard.com/kb/general/ad-filtering/create-own-filters/#rule-priorities}
 */
export class CspService {
    /**
     * Adds a CSP report blocking rule to the declarative net request API.
     */
    public static async addCspReportBlockingRule(): Promise<void> {
        const rule: chrome.declarativeNetRequest.Rule = {
            id: SessionRuleId.CspReportBlocking,
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
     * **IMPORTANT**: We EXPECT these requests to be blocked by DNR rules, but cannot know for certain
     * in production mode. We mark them as "blocked" for convenience in filtering logs.
     *
     * @param context Request context.
     */
    public static onBeforeRequest(context: RequestContext): void {
        const {
            requestType,
            thirdParty,
            tabId,
            referrerUrl,
        } = context;

        if (requestType !== RequestType.CspReport) {
            return;
        }

        if (thirdParty) {
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

    /**
     * Removes all CSP rules.
     */
    public static clearAll(): void {
        SessionRulesApi.removeSessionRule(SessionRuleId.CspReportBlocking);
    }
}
