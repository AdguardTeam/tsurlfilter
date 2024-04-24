import browser, { type WebRequest } from 'webextension-polyfill';
import {
    RequestType,
    NetworkRuleOption,
    NetworkRule,
} from '@adguard/tsurlfilter';

import { tabsApi } from '../../tabs/tabs-api';

/**
 * Params for {@link RequestBlockingApi.getBlockingResponse}.
 */
type GetBlockingResponseParams = {
    tabId: number,
    referrerUrl: string,
    requestType: RequestType,
    rule: NetworkRule | null,
    popupRule: NetworkRule | null,
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
     * @param data.tabId Tab id.
     *
     * @returns Response for {@link WebRequestApi.onBeforeRequest} listener.
     */
    private static closeTab({ tabId }: GetBlockingResponseParams): WebRequest.BlockingResponse {
        browser.tabs.remove(tabId);

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
            return undefined;
        }

        // TODO: Check that redirected url is exists in our resources.
        if (rule.isOptionEnabled(NetworkRuleOption.Redirect)) {
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
                return RequestBlockingApi.closeTab(data);
            }
            // to handle rules with $all modifier, where popup was added implicitly
            if (rule.isOptionEnabled(NetworkRuleOption.Popup) && tabsApi.isNewPopupTab(tabId)) {
                return RequestBlockingApi.closeTab(data);
            }

            // we do not want to block the main page if rule has only $popup modifier
            if (rule === popupRule && !tabsApi.isNewPopupTab(tabId)) {
                return undefined;
            }

            // but if the blocking rule has $document modifier, blocking page should be shown
            // e.g. `||example.com^$document`
            if ((rule.getPermittedRequestTypes() & RequestType.Document) === RequestType.Document) {
                return { cancel: true };
            }

            return undefined;
        }

        return { cancel: true };
    }
}
