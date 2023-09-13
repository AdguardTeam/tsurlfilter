import browser, { type WebRequest } from 'webextension-polyfill';
import { RequestType, NetworkRuleOption, NetworkRule } from '@adguard/tsurlfilter';

import { defaultFilteringLog, FilteringEventType } from '../../../common/filtering-log';
import { documentBlockingService } from '../services/document-blocking-service';
import { redirectsService } from '../services/redirects/redirects-service';
import { tabsApi, engineApi } from '../api';
import { ContentType } from '../../../common/request-type';

/**
 * Params for {@link RequestBlockingApi.getBlockingResponse}.
 */
type GetBlockingResponseParams = {
    tabId: number,
    eventId: string,
    rule: NetworkRule | null,
    referrerUrl: string,
    requestUrl: string,
    requestType: RequestType,
    contentType: ContentType,
};

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
     * @param data Data for request processing.
     *
     * @returns Response for {@link WebRequestApi.onBeforeRequest} listener.
     */
    public static getBlockingResponse(data: GetBlockingResponseParams): WebRequest.BlockingResponse | void {
        const {
            rule,
            requestType,
            tabId,
            eventId,
            requestUrl,
            referrerUrl,
        } = data;

        if (!rule) {
            return undefined;
        }

        if (rule.isAllowlist()) {
            RequestBlockingApi.logRuleApplying(data);
            return undefined;
        }

        // If the request is a document request.
        if (requestType === RequestType.Document) {
            // First, make sure that the content-types of the matching rule include
            // the content-type of the document.
            if ((rule.getPermittedRequestTypes() & RequestType.Document) !== RequestType.Document) {
                return undefined;
            }

            // Blocking rule can be with $popup modifier - in this case we need
            // to close the tab as soon as possible.
            // https://adguard.com/kb/ru/general/ad-filtering/create-own-filters/#popup-modifier
            if (rule.isOptionEnabled(NetworkRuleOption.Popup)) {
                const isNewTab = tabsApi.isNewPopupTab(tabId);

                if (isNewTab) {
                    RequestBlockingApi.logRuleApplying(data);
                    browser.tabs.remove(tabId);
                    return { cancel: true };
                }
            }

            // For all other blocking rules, we return our dummy page with the
            // option to temporarily disable blocking for the specified domain.
            return documentBlockingService.getDocumentBlockingResponse({
                eventId,
                requestUrl,
                referrerUrl,
                rule,
                tabId,
            });
        }

        if (rule.isOptionEnabled(NetworkRuleOption.Redirect)) {
            const redirectUrl = redirectsService.createRedirectUrl(rule.getAdvancedModifierValue(), requestUrl);
            if (redirectUrl) {
                RequestBlockingApi.logRuleApplying(data);
                // redirects should be considered as blocked for the tab blocked request count
                // which is displayed on the extension badge
                // https://github.com/AdguardTeam/AdguardBrowserExtension/issues/2443
                tabsApi.incrementTabBlockedRequestCount(tabId);
                return { redirectUrl };
            }
        }

        RequestBlockingApi.logRuleApplying(data);
        return { cancel: true };
    }

    /**
     * Processes rule applying for request and compute response for {@link WebRequestApi.onHeadersReceived} listener.
     * @param rule Matched rule.
     * @param responseHeaders Response headers.
     * @param requestId Request id.
     * @param tabId Tab id.
     *
     * @returns Response for {@link WebRequestApi.onHeadersReceived} listener.
     */
    public static getResponseOnHeadersReceived(
        rule: NetworkRule | null,
        responseHeaders: WebRequest.HttpHeaders | undefined,
        requestId: string,
        tabId: number,
    ): WebRequestBlockingResponse {
        if (!rule || !responseHeaders) {
            return undefined;
        }

        RequestBlockingApi.logRuleApplying(requestId, rule, tabId);
        return rule.isAllowlist() ? undefined : { cancel: true };
    }

    /**
     * Creates {@link FilteringLog} event of rule applying for processed request.
     *
     * @param data Data for request processing.
     */
    private static logRuleApplying(data: GetBlockingResponseParams): void {
        const {
            tabId,
            eventId,
            rule,
            referrerUrl,
            requestUrl,
            contentType,
        } = data;

        if (!rule) {
            return;
        }

        defaultFilteringLog.publishEvent({
            type: FilteringEventType.ApplyBasicRule,
            data: {
                tabId,
                eventId,
                requestType: contentType,
                frameUrl: referrerUrl,
                requestUrl,
                rule,
            },
        });
    }
}
