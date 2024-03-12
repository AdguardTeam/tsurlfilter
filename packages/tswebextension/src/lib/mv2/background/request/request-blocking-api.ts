import browser, { type WebRequest } from 'webextension-polyfill';
import {
    RequestType,
    NetworkRuleOption,
    NetworkRule,
} from '@adguard/tsurlfilter';

import { defaultFilteringLog, FilteringEventType } from '../../../common/filtering-log';
import {
    tabsApi,
    engineApi,
    redirectsService,
    documentBlockingService,
} from '../api';
import { ContentType } from '../../../common/request-type';

/**
 * Params for {@link RequestBlockingApi.getBlockingResponse}.
 */
export type GetBlockingResponseParams = {
    tabId: number,
    eventId: string,
    rule: NetworkRule | null,
    popupRule: NetworkRule | null,
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
     * Closes the tab which considered as a popup.
     *
     * @param data Needed data for logging closing of tab.
     *
     * @returns Response for {@link WebRequestApi.onBeforeRequest} listener.
     */
    private static closeTab(data: GetBlockingResponseParams): WebRequest.BlockingResponse {
        RequestBlockingApi.logRuleApplying(data);
        browser.tabs.remove(data.tabId);

        return { cancel: true };
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
            popupRule,
            requestType,
            tabId,
            eventId,
            requestUrl,
            referrerUrl,
        } = data;

        if (!rule) {
            if (popupRule && requestType === RequestType.Document && tabsApi.isNewPopupTab(tabId)) {
                return RequestBlockingApi.closeTab(data);
            }

            return undefined;
        }

        if (rule.isAllowlist()) {
            RequestBlockingApi.logRuleApplying(data);
            return undefined;
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

        // Blocking rule can be with $popup modifier - in this case we need
        // to close the tab as soon as possible.
        // https://adguard.com/kb/general/ad-filtering/create-own-filters/#popup-modifier
        if (popupRule && requestType === RequestType.Document && tabsApi.isNewPopupTab(tabId)) {
            return RequestBlockingApi.closeTab(data);
        }

        // Basic rules for blocking requests are applied only to sub-requests
        // so `||example.com^` will not block the main page
        // https://adguard.com/kb/general/ad-filtering/create-own-filters/#basic-rules
        if (requestType === RequestType.Document) {
            const isNewTab = tabsApi.isNewPopupTab(tabId);
            // $popup can be enabled inside $all. That's why if basic rule has
            // $all modifier, and explicitly enabled $popup, and if tab is newly
            // opened tab - we should close it.
            if (rule.isOptionEnabled(NetworkRuleOption.Popup) && isNewTab) {
                return RequestBlockingApi.closeTab(data);
            }

            // but if the blocking rule has $document modifier, blocking page should be shown
            // e.g. `||example.com^$document`
            if ((rule.getPermittedRequestTypes() & RequestType.Document) === RequestType.Document) {
                return documentBlockingService.getDocumentBlockingResponse({
                    eventId,
                    requestUrl,
                    referrerUrl,
                    rule,
                    tabId,
                });
            }

            return undefined;
        }

        RequestBlockingApi.logRuleApplying(data);
        return { cancel: true };
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
