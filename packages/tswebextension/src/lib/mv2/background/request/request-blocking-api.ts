import browser, { WebRequest } from 'webextension-polyfill';
import { RequestType, NetworkRuleOption, NetworkRule } from '@adguard/tsurlfilter';

import { defaultFilteringLog, FilteringEventType } from '../../../common/filtering-log';
import { documentBlockingService } from '../services/document-blocking-service';
import { redirectsService } from '../services/redirects/redirects-service';
import { tabsApi, engineApi } from '../api';

export type WebRequestBlockingResponse = WebRequest.BlockingResponse | void;

/**
 * Api for processing request filtering.
 *
 * Method {@link getBlockingResponse} processes rule applying for request and computes response
 * for {@link WebRequestApi.onBeforeRequest} listener.
 *
 * Method {@link shouldCollapseElement} checks, if initializer for request should be collapsed by content-script.
 *
 * This class also provides method {@link isRequestBlockedByRule} for checking, if rule is blocking rule.
 */
export class RequestBlockingApi {
    /**
     * In some cases request blocking breaks images and frames on page.
     * We match rule from content-script and decide if DOM element should be hidden via css.
     *
     * @param tabId Tab id.
     * @param url Request url.
     * @param referrerUrl Request initializer frame url.
     * @param requestType Type of request.
     *
     * @returns True, if element should be collapsed, else returns false.
     */
    public static shouldCollapseElement(
        tabId: number,
        url: string,
        referrerUrl: string,
        requestType: RequestType,
    ): boolean {
        const result = engineApi.matchRequest({
            requestUrl: url,
            frameUrl: referrerUrl,
            requestType,
            frameRule: tabsApi.getTabFrameRule(tabId),
        });

        if (!result) {
            return false;
        }

        return RequestBlockingApi.isRequestBlockedByRule(result.getBasicResult());
    }

    /**
     * Checks if request rule is blocked.
     *
     * @param requestRule Request network rule or null.
     * @returns True, if rule is request blocking, else returns false.
     */
    public static isRequestBlockedByRule(requestRule: NetworkRule | null): boolean {
        return !!requestRule
            && !requestRule.isAllowlist()
            && !requestRule.isOptionEnabled(NetworkRuleOption.Replace)
            && !requestRule.isOptionEnabled(NetworkRuleOption.Redirect);
    }

    /**
     * Processes rule applying for request and compute response for {@link WebRequestApi.onBeforeRequest} listener.
     *
     * @param rule Matched rule.
     * @param requestId Request id.
     * @param requestUrl Request url.
     * @param method Request method.
     * @param requestType Request type.
     * @param tabId Tab id.
     *
     * @returns Response for {@link WebRequestApi.onBeforeRequest} listener.
     */
    public static getBlockingResponse(
        rule: NetworkRule | null,
        requestId: string,
        requestUrl: string,
        requestType: RequestType,
        tabId: number,
    ): WebRequestBlockingResponse {
        if (!rule) {
            return undefined;
        }

        if (rule.isAllowlist()) {
            RequestBlockingApi.logRuleApplying(requestId, rule, tabId);
            return undefined;
        }

        if (requestType === RequestType.Document) {
            if ((rule.getPermittedRequestTypes() & RequestType.Document) === RequestType.Document) {
                return documentBlockingService.getDocumentBlockingResponse(
                    requestId,
                    requestUrl,
                    rule,
                    tabId,
                );
            }

            if (rule.isOptionEnabled(NetworkRuleOption.Popup)) {
                const isNewTab = tabsApi.isNewPopupTab(tabId);

                if (isNewTab) {
                    RequestBlockingApi.logRuleApplying(requestId, rule, tabId);
                    browser.tabs.remove(tabId);
                    return { cancel: true };
                }
            }

            // Other url blocking rules are not applicable to main frame
            return undefined;
        }

        if (rule.isOptionEnabled(NetworkRuleOption.Redirect)) {
            const redirectUrl = redirectsService.createRedirectUrl(rule.getAdvancedModifierValue(), requestUrl);
            if (redirectUrl) {
                RequestBlockingApi.logRuleApplying(requestId, rule, tabId);
                return { redirectUrl };
            }
        }

        RequestBlockingApi.logRuleApplying(requestId, rule, tabId);
        return { cancel: true };
    }

    /**
     * Creates {@link FilteringLog} event of rule applying for processed request.
     *
     * @param requestId Request id.
     * @param requestRule Request rule.
     * @param tabId Tab id.
     */
    private static logRuleApplying(
        requestId: string,
        requestRule: NetworkRule,
        tabId: number,
    ): void {
        defaultFilteringLog.publishEvent({
            type: FilteringEventType.ApplyBasicRule,
            data: {
                eventId: requestId,
                tabId,
                rule: requestRule,
            },
        });
    }
}
