import browser, { type WebRequest } from 'webextension-polyfill';
import { RequestType, NetworkRuleOption, type NetworkRule } from '@adguard/tsurlfilter';

import { tabsApi } from '../../tabs/tabs-api';
import { companiesDbService } from '../../../common/companies-db-service';
import { FilteringEventType, defaultFilteringLog } from '../../../common/filtering-log';

import { type RequestContext } from './request-context-storage';

/**
 * Base params about request.
 */
type RequestParams = Pick<
    RequestContext,
    'tabId' |
    'eventId' |
    'referrerUrl' |
    'requestId' |
    'requestUrl' |
    'requestType' |
    'contentType'
>;

/**
 * Params for {@link RequestBlockingApi.getBlockingResponse}.
 */
export type GetBlockingResponseParams = RequestParams & {
    rule: NetworkRule | null;
    popupRule: NetworkRule | null;
};

/**
 * Params for {@link RequestBlockingApi.getResponseOnHeadersReceived}.
 */
export type GetHeadersResponseParams = RequestParams & {
    rule: NetworkRule | null;
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
     * Checks if request rule is blocked.
     *
     * @param requestRule Request network rule or null.
     *
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
            eventId,
            requestId,
            requestUrl,
            contentType,
            referrerUrl,
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
            defaultFilteringLog.publishEvent({
                type: FilteringEventType.ApplyBasicRule,
                data: {
                    tabId,
                    eventId,
                    requestType: contentType,
                    frameUrl: referrerUrl,
                    requestId,
                    requestUrl,
                    companyCategoryName: companiesDbService.match(requestUrl),
                    filterId: rule.getFilterListId(),
                    ruleIndex: rule.getIndex(),
                    isAllowlist: rule.isAllowlist(),
                    isImportant: rule.isOptionEnabled(NetworkRuleOption.Important),
                    isDocumentLevel: rule.isDocumentLevelAllowlistRule(),
                    isCsp: rule.isOptionEnabled(NetworkRuleOption.Csp),
                    isCookie: rule.isOptionEnabled(NetworkRuleOption.Cookie),
                    advancedModifier: rule.getAdvancedModifierValue(),
                    isAssuredlyBlocked: true,
                },
            });

            // TODO: Check that redirected url exists in our resources as in mv2.
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
            eventId,
            referrerUrl,
            requestId,
            requestUrl,
            requestType,
            contentType,
        } = data;

        if (!appliedRule || requestType === 0) {
            return;
        }

        defaultFilteringLog.publishEvent({
            type: FilteringEventType.ApplyBasicRule,
            data: {
                tabId,
                eventId,
                requestType: contentType,
                frameUrl: referrerUrl,
                requestId,
                requestUrl,
                filterId: appliedRule.getFilterListId(),
                ruleIndex: appliedRule.getIndex(),
                isAllowlist: appliedRule.isAllowlist(),
                isImportant: appliedRule.isOptionEnabled(NetworkRuleOption.Important),
                isDocumentLevel: appliedRule.isDocumentLevelAllowlistRule(),
                isCsp: appliedRule.isOptionEnabled(NetworkRuleOption.Csp),
                isCookie: appliedRule.isOptionEnabled(NetworkRuleOption.Cookie),
                advancedModifier: appliedRule.getAdvancedModifierValue(),
            },
        });
    }
}
