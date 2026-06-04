import browser, { type WebRequest } from 'webextension-polyfill';

import { type NetworkRule, NetworkRuleOption, RequestType } from '@adguard/tsurlfilter';

import { companiesDbService } from '../../../common/companies-db-service';
import { defaultFilteringLog, FilteringEventType } from '../../../common/filtering-log';
import { getRuleTexts } from '../../../common/utils/rule-text-provider';
import { tabsApi } from '../../tabs/tabs-api';
import { engineApi } from '../engine-api';

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
     * Set of tab ids for which `closeTab` has already been invoked
     * but `browser.tabs.remove` has not yet resolved.
     *
     * In MV3 `webRequest` is observe-only — `return { cancel: true }` is a
     * no-op, so the popup tab keeps loading and any redirect (e.g. http→https)
     * arrives as a fresh `onBeforeRequest`. Without this guard, that second
     * event would publish a duplicate `PopupBlocked` event and queue another
     * `tabs.remove` call for an already-closing tab.
     */
    private static readonly closingPopupTabs = new Set<number>();

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
        // Skip if this popup tab is already being closed. In MV3 the cancel
        // response is observe-only, so a server-side 301 (e.g.
        // http://evilsite.com/ → https://evilsite.com/) will produce a second
        // `onBeforeRequest` for the same tab while `tabs.remove` is still in
        // flight, which would otherwise duplicate the filtering-log entry.
        if (RequestBlockingApi.closingPopupTabs.has(data.tabId)) {
            return { cancel: true };
        }
        RequestBlockingApi.closingPopupTabs.add(data.tabId);

        // Publish a dedicated `PopupBlocked` event with the real popup tabId.
        // Browser extension filtering log decides where to attach the entry —
        // typically the background page — since the popup tab is removed
        // immediately after this call and would otherwise have no UI surface
        // to render the entry under.
        // https://github.com/AdguardTeam/AdguardBrowserExtension/issues/1686
        RequestBlockingApi.publishPopupBlockedEvent(data, appliedRule);

        browser.tabs.remove(data.tabId).finally(() => {
            RequestBlockingApi.closingPopupTabs.delete(data.tabId);
        });

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
            const { appliedRuleText, originalRuleText } = getRuleTexts(rule, engineApi);

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
                    appliedRuleText,
                    originalRuleText,
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
     * Logs header rule that would be blocked.
     * In MV3, we don't actually block in web request API, but we log supposedly blocked requests.
     *
     * @param context Request context.
     */
    public static logHeaderRuleIfAny(context: RequestContext): void {
        const {
            matchingResult,
            responseHeaders,
            tabId,
            referrerUrl,
            parentDocumentId,
            frameAncestors,
        } = context;

        if (!matchingResult || !responseHeaders) {
            return;
        }

        const rule = matchingResult.getResponseHeadersResult(responseHeaders);

        if (rule) {
            RequestBlockingApi.logRuleApplying(context, rule);
            tabsApi.incrementTabBlockedRequestCount({
                tabId,
                referrerUrl,
                parentDocumentId,
                frameAncestors,
            });
        }
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

        const { appliedRuleText, originalRuleText } = getRuleTexts(appliedRule, engineApi);

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
                appliedRuleText,
                originalRuleText,
                isAllowlist: appliedRule.isAllowlist(),
                isImportant: appliedRule.isOptionEnabled(NetworkRuleOption.Important),
                isDocumentLevel: appliedRule.isDocumentLevelAllowlistRule(),
                isCsp: appliedRule.isOptionEnabled(NetworkRuleOption.Csp),
                isCookie: appliedRule.isOptionEnabled(NetworkRuleOption.Cookie),
                advancedModifier: appliedRule.getAdvancedModifierValue(),
            },
        });
    }

    /**
     * Publishes a {@link FilteringEventType.PopupBlocked} event for a tab
     * that is being closed by a `$popup` modifier rule.
     *
     * The event carries the real popup `tabId`. Consumers decide where to
     * attach the entry (typically the background page) since the popup tab
     * is removed immediately after the event is published.
     *
     * @param data Data for the popup request being blocked.
     * @param appliedRule Network rule that was applied to the request.
     */
    private static publishPopupBlockedEvent(
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

        const { appliedRuleText, originalRuleText } = getRuleTexts(appliedRule, engineApi);

        defaultFilteringLog.publishEvent({
            type: FilteringEventType.PopupBlocked,
            data: {
                tabId,
                eventId,
                requestType: contentType,
                frameUrl: referrerUrl,
                requestId,
                requestUrl,
                filterId: appliedRule.getFilterListId(),
                ruleIndex: appliedRule.getIndex(),
                appliedRuleText,
                originalRuleText,
                isAllowlist: appliedRule.isAllowlist(),
                isImportant: appliedRule.isOptionEnabled(NetworkRuleOption.Important),
                isDocumentLevel: appliedRule.isDocumentLevelAllowlistRule(),
                // TODO: we should simplify events like this and exclude unused fields
                // e.g. isCsp, isCookie, isAllowlist if we already know that this is $popup rule
                isCsp: appliedRule.isOptionEnabled(NetworkRuleOption.Csp),
                isCookie: appliedRule.isOptionEnabled(NetworkRuleOption.Cookie),
                advancedModifier: appliedRule.getAdvancedModifierValue(),
            },
        });
    }
}
