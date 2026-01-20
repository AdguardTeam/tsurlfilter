import { type WebRequest } from 'webextension-polyfill';
import { NetworkRuleOption, type NetworkRule, type RemoveHeaderModifier } from '@adguard/tsurlfilter';

import { findHeaderByName, removeHeader } from '../../../common/utils/headers';
import { getDomain } from '../../../common/utils/url';
import { getRuleTexts, type RuleTextProvider } from '../../../common/utils/rule-text-provider';
import { nanoid } from '../../../common/utils/nanoid';
import { type RequestContext, requestContextStorage } from '../request/request-context-storage';
import { FilteringEventType, type FilteringLogInterface } from '../../../common/filtering-log';

/**
 * Headers filtering service module.
 */
export class RemoveHeadersService {
    private filteringLog: FilteringLogInterface;

    /**
     * Engine API for retrieving rule texts.
     */
    private readonly engineApi: RuleTextProvider;

    /**
     * Constructor.
     *
     * @param filteringLog Filtering log.
     * @param ruleTextProvider Rule text provider.
     */
    constructor(filteringLog: FilteringLogInterface, ruleTextProvider: RuleTextProvider) {
        this.filteringLog = filteringLog;
        this.engineApi = ruleTextProvider;
    }

    /**
     * Modifies headers by applying $removeheader rules.
     *
     * @param context Request context.
     * @param isRequestHeaders Is headers are _request_ headers, i.e. `false`
     * for _response_ headers.
     * @param headersToModify Headers to modify.
     *
     * @returns True if headers were modified.
     */
    private modifyHeaders(
        context: RequestContext,
        isRequestHeaders: boolean,
        headersToModify?: WebRequest.HttpHeaders,
    ): boolean {
        const {
            matchingResult,
            tabId,
            requestUrl,
            contentType,
            timestamp,
        } = context;

        if (!headersToModify || !matchingResult) {
            return false;
        }

        const rules = matchingResult.getRemoveHeaderRules();
        if (rules.length === 0) {
            return false;
        }

        let isModified = false;

        rules.forEach((rule: NetworkRule) => {
            let isAppliedRule = false;
            if (rule.isAllowlist()) {
                // Allowlist rules must be applicable by header name to be logged
                isAppliedRule = RemoveHeadersService
                    .isApplicableRemoveHeaderRule(headersToModify, rule, isRequestHeaders);
            } else {
                isAppliedRule = RemoveHeadersService.applyRule(headersToModify, rule, isRequestHeaders);
                if (!isModified && isAppliedRule) {
                    isModified = true;
                }
            }

            if (isAppliedRule) {
                const { appliedRuleText, originalRuleText } = getRuleTexts(rule, this.engineApi);

                this.filteringLog.publishEvent({
                    type: FilteringEventType.RemoveHeader,
                    data: {
                        removeHeader: true,
                        headerName: rule.getAdvancedModifierValue()!,
                        eventId: nanoid(),
                        tabId,
                        requestUrl,
                        frameUrl: requestUrl,
                        frameDomain: getDomain(requestUrl) as string,
                        requestType: contentType,
                        timestamp,
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
                    },
                });
            }
        });

        return isModified;
    }

    /**
     * On before send headers handler.
     * Removes request headers.
     *
     * @param context Request context.
     *
     * @returns True if headers were modified.
     */
    public onBeforeSendHeaders(context: RequestContext): boolean {
        const { requestHeaders, requestId } = context;

        const isModified = this.modifyHeaders(context, true, requestHeaders);

        if (isModified) {
            requestContextStorage.update(requestId, { requestHeaders });
        }

        return isModified;
    }

    /**
     * On headers received handler.
     * Removes response headers.
     *
     * @param context Request context.
     *
     * @returns True if headers were modified.
     */
    public onHeadersReceived(context: RequestContext): boolean {
        const { responseHeaders, requestId } = context;

        const isModified = this.modifyHeaders(context, false, responseHeaders);

        if (isModified) {
            requestContextStorage.update(requestId, { responseHeaders });
        }

        return isModified;
    }

    /**
     * Applies rule to headers. Removes header from headers if rule matches.
     * Important: this method modifies headers array as they are passed by reference.
     *
     * @param headers Headers.
     * @param rule Rule to apply if it has remove header modifier.
     * @param isRequestHeaders Is headers are _request_ headers, i.e. `false`
     * for _response_ headers.
     *
     * @returns True if headers removed by rule.
     */
    private static applyRule(
        headers: WebRequest.HttpHeadersItemType[],
        rule: NetworkRule,
        isRequestHeaders: boolean,
    ): boolean {
        const headerName = RemoveHeadersService.getApplicableHeaderName(rule, isRequestHeaders);
        if (!headerName) {
            return false;
        }

        return removeHeader(headers, headerName);
    }

    /**
     * Checks if rule is applicable to headers.
     *
     * @param headers   Headers.
     * @param rule  Rule with $removeheader modifier.
     * @param isRequestHeaders Is headers are _request_ headers, i.e. `false`
     * for _response_ headers.
     *
     * @returns True if rule is applicable.
     */
    private static isApplicableRemoveHeaderRule(
        headers: WebRequest.HttpHeadersItemType[],
        rule: NetworkRule,
        isRequestHeaders: boolean,
    ): boolean {
        const headerName = RemoveHeadersService.getApplicableHeaderName(rule, isRequestHeaders);
        if (!headerName) {
            return false;
        }

        return !!findHeaderByName(headers, headerName);
    }

    /**
     * Returns header name if rule has remove header modifier and it is applicable.
     *
     * @param rule Rule with $removeheader modifier.
     * @param isRequestHeaders Is headers are _request_ headers, i.e. `false`
     * for _response_ headers.
     *
     * @returns Header name or null if rule is not applicable.
     */
    private static getApplicableHeaderName(
        rule: NetworkRule,
        isRequestHeaders: boolean,
    ): string | null {
        const modifier = rule.getAdvancedModifier() as RemoveHeaderModifier;
        if (!modifier) {
            return null;
        }

        const headerName = modifier.getApplicableHeaderName(isRequestHeaders);
        if (!headerName) {
            return null;
        }

        return headerName;
    }
}
