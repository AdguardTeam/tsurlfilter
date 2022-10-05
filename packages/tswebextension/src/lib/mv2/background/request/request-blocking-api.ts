import browser, { WebRequest } from 'webextension-polyfill';
import { RequestType, NetworkRuleOption, NetworkRule } from '@adguard/tsurlfilter';
import { defaultFilteringLog, FilteringEventType } from '../../../common/filtering-log';
import { engineApi } from '../engine-api';
import { redirectsService } from '../services/redirects-service';
import { tabsApi } from '../tabs';
import { documentBlockingService } from '../services/document-blocking-service';

export type WebRequestBlockingResponse = WebRequest.BlockingResponse | void;

/**
 * Api for processing request filtering.
 *
 * {@link getBlockingResponse} method processes rule applying for request
 * and compute response for {@link WebRequestApi.onBeforeRequest} listener.
 *
 * {@link shouldCollapseElement} method checks, if initializer
 * for request should be collapsed by content-script
 *
 * This class also provides method {@link isRequestBlockedByRule}
 * for checking, if rule is blocking rule
 */
export class RequestBlockingApi {
    /**
     * In some cases request blocking breaks images and frames on page.
     * We match rule from content-script and decide if DOM element should be hidden via css.
     *
     * @param tabId - tab id
     * @param url - request url
     * @param referrerUrl - request initializer frame url
     * @param requestType - type of request
     *
     * @returns true, if element should be collapsed, else returns false
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
     * Checks, if request rule is blocking
     *
     * @param requestRule - request network rule or null
     * @returns true, if rule is request blocking, else returns false
     */
    public static isRequestBlockedByRule(requestRule: NetworkRule | null): boolean {
        return !!requestRule
            && !requestRule.isAllowlist()
            && !requestRule.isOptionEnabled(NetworkRuleOption.Replace)
            && !requestRule.isOptionEnabled(NetworkRuleOption.Redirect);
    }

    /**
     * Processes rule applying for request and compute response
     * for {@link WebRequestApi.onBeforeRequest} listener
     *
     * @param rule - matched rule
     * @param requestId - request id
     * @param requestUrl - request url
     * @param requestType -request type
     * @param tabId - tab id
     *
     * @returns response for {@link WebRequestApi.onBeforeRequest} listener
     */
    public static getBlockingResponse(
        rule: NetworkRule | null,
        requestId: string,
        requestUrl: string,
        requestType: RequestType,
        tabId: number,
    ): WebRequestBlockingResponse {
        if (!rule) {
            return;
        }

        if (rule.isAllowlist()) {
            RequestBlockingApi.logRuleApplying(requestId, rule, tabId);
            return;
        }

        if (requestType === RequestType.Document) {
            if (rule.isOptionEnabled(NetworkRuleOption.Document)) {
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
            return;
        }

        // Replace rules are processed in content-filtering
        if (rule.isOptionEnabled(NetworkRuleOption.Replace)) {
            return;
        }

        if (rule.isOptionEnabled(NetworkRuleOption.Redirect)) {
            const redirectUrl = redirectsService.createRedirectUrl(rule.getAdvancedModifierValue());
            if (redirectUrl) {
                RequestBlockingApi.logRuleApplying(requestId, rule, tabId);
                return { redirectUrl };
            }
        }

        RequestBlockingApi.logRuleApplying(requestId, rule, tabId);
        return { cancel: true };
    }

    /**
     * Creates {@link FilteringLog} event of rule applying for processed request
     *
     * @param requestId - request id
     * @param requestRule - request rule
     * @param tabId - tab id
     */
    private static logRuleApplying(
        requestId: string,
        requestRule: NetworkRule,
        tabId: number,
    ) {
        defaultFilteringLog.publishEvent({
            type: FilteringEventType.APPLY_BASIC_RULE,
            data: {
                eventId: requestId,
                tabId,
                rule: requestRule,
            },
        });
    }
}
