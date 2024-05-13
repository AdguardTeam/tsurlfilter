import browser, { type WebRequest } from 'webextension-polyfill';
import {
    RequestType,
    NetworkRuleOption,
    NetworkRule,
} from '@adguard/tsurlfilter';

import { tabsApi } from '../../tabs/tabs-api';
import { FilteringEventType, defaultFilteringLog } from '../../../common/filtering-log';
import { ContentType } from '..';

/**
 * Base params about request.
 */
type RequestParams = {
    tabId: number,
    referrerUrl: string,
    requestUrl: string,
    requestType: RequestType,
};

/**
 * Params for {@link RequestBlockingApi.getBlockingResponse}.
 */
export type GetBlockingResponseParams = RequestParams & {
    rule: NetworkRule | null,
    popupRule: NetworkRule | null,
};

/**
 * Params for {@link RequestBlockingApi.getResponseOnHeadersReceived}.
 */
export type GetHeadersResponseParams = RequestParams & {
    rule: NetworkRule | null,
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
     * Closes the tab which considered as a popup.
     *
     * @param data Needed data for logging closing of tab.
     * @param appliedRule Network rule which was applied to request. This field
     * is needed because data contains two rules: one for the request and
     * one for the popup. And we should log only the rule which was applied
     * to the request.
     *
     * @returns Response for {@link RequestApi.onBeforeRequest} listener.
     */
    private static closeTab(
        data: RequestParams,
        appliedRule: NetworkRule | null,
    ): WebRequest.BlockingResponse {
        RequestBlockingApi.logRuleApplying(data, appliedRule);
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
        } = data;

        if (!rule) {
            return undefined;
        }

        // popup rule will be handled in the condition with requestType === document below
        if (popupRule === rule && requestType !== RequestType.Document) {
            return undefined;
        }

        if (rule.isAllowlist()) {
            RequestBlockingApi.logRuleApplying(data, rule);
            return undefined;
        }

        if (rule.isOptionEnabled(NetworkRuleOption.Redirect)) {
            // TODO: Check that redirected url is exists in our resources as in mv2.
            return { redirectUrl: '' };
        }

        // Basic rules for blocking requests are applied only to sub-requests
        // so `||example.com^` will not block the main page
        // https://adguard.com/kb/general/ad-filtering/create-own-filters/#basic-rules
        // For document requests we need to show blocking page or close tab.
        if (requestType === RequestType.Document) {
            // Blocking rule can be with $popup modifier - in this case we need
            // to close the tab as soon as possible.
            // https://adguard.com/kb/general/ad-filtering/create-own-filters/#popup-modifier
            if (popupRule && tabsApi.isNewPopupTab(tabId)) {
                return RequestBlockingApi.closeTab(data, popupRule);
            }
            // to handle rules with $all modifier, where popup was added implicitly
            if (rule.isOptionEnabled(NetworkRuleOption.Popup) && tabsApi.isNewPopupTab(tabId)) {
                return RequestBlockingApi.closeTab(data, rule);
            }

            // we do not want to block the main page if rule has only $popup modifier
            if (rule === popupRule && !tabsApi.isNewPopupTab(tabId)) {
                return undefined;
            }

            // but if the blocking rule has $document modifier, blocking page should be shown
            // e.g. `||example.com^$document`
            if ((rule.getPermittedRequestTypes() & RequestType.Document) === RequestType.Document) {
                RequestBlockingApi.logRuleApplying(data, rule);
                return { cancel: true };
            }

            return undefined;
        }

        RequestBlockingApi.logRuleApplying(data, rule);
        return { cancel: true };
    }

    /**
     * Creates {@link FilteringLog} event of rule applying for processed request.
     *
     * @param data Data for request processing.
     * @param appliedRule Network rule which was applied to request.
     */
    private static logRuleApplying(
        data: RequestParams,
        appliedRule: NetworkRule | null,
    ): void {
        const {
            tabId,
            referrerUrl,
            requestUrl,
            requestType,
        } = data;

        if (!appliedRule || requestType === 0) {
            return;
        }

        // We need this only for count total blocked requests,
        // so we can skip contentType.
        defaultFilteringLog.publishEvent({
            type: FilteringEventType.ApplyBasicRule,
            data: {
                tabId,
                // TODO: Check if eventId is needed in mv3.
                eventId: '1',
                // TODO: Fix this.
                requestType: ContentType.Document,
                frameUrl: referrerUrl,
                requestUrl,
                rule: appliedRule,
            },
        });
    }
}
