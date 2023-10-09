import { nanoid } from 'nanoid';
import { WebRequest } from 'webextension-polyfill';
import { NetworkRule, NetworkRuleOption, RemoveHeaderModifier } from '@adguard/tsurlfilter';

import {
    defaultFilteringLog,
    FilteringEventType,
    FilteringLogInterface,
    getDomain,
} from '../../../common';
import { removeHeader, findHeaderByName } from '../utils/headers';
import { RequestContext, requestContextStorage } from '../request';

/**
 * Headers filtering service module.
 */
export class RemoveHeadersService {
    private filteringLog: FilteringLogInterface;

    /**
     * Constructor.
     *
     * @param filteringLog Filtering log.
     */
    constructor(filteringLog: FilteringLogInterface) {
        this.filteringLog = filteringLog;
    }

    /**
     * On before send headers handler.
     * Removes request headers.
     *
     * @param context Request context.
     * @returns True if headers were modified.
     */
    public onBeforeSendHeaders(context: RequestContext): boolean {
        const {
            requestHeaders,
            matchingResult,
            tabId,
            requestUrl,
            requestId,
            contentType,
            timestamp,
        } = context;

        if (!requestHeaders || !matchingResult) {
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
                isAppliedRule = HeadersService
                    .isApplicableRemoveHeaderRule(requestHeaders, rule, true);
            } else {
                isAppliedRule = HeadersService.applyRule(requestHeaders, rule, true);
                if (!isModified && isAppliedRule) {
                    isModified = true;
                }
            }

            if (isAppliedRule) {
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
                        rule,
                    },
                });
            }
        });

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
     * @returns True if headers were modified.
     */
    public onHeadersReceived(context: RequestContext): boolean {
        const {
            responseHeaders,
            matchingResult,
            tabId,
            requestUrl,
            requestId,
            contentType,
            timestamp,
        } = context;

        if (!responseHeaders || !matchingResult) {
            return false;
        }

        const rules = matchingResult.getRemoveHeaderRules();
        if (rules.length === 0) {
            return false;
        }

        let isModified = false;

        rules.forEach((rule) => {
            let isAppliedRule = false;
            if (rule.isAllowlist()) {
                // Allowlist rules must be applicable by header name to be logged
                isAppliedRule = HeadersService
                    .isApplicableRemoveHeaderRule(responseHeaders, rule, false);
            } else {
                isAppliedRule = HeadersService.applyRule(responseHeaders, rule, false);
                if (!isModified && isAppliedRule) {
                    isModified = true;
                }
            }
            if (isAppliedRule) {
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
                        rule,
                    },
                });
            }
        });

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
     * @param isRequestHeaders Is request headers.
     * @returns True if headers removed by rule.
     */
    private static applyRule(
        headers: WebRequest.HttpHeadersItemType[],
        rule: NetworkRule,
        isRequestHeaders: boolean,
    ): boolean {
        const headerName = HeadersService.getApplicableHeaderName(rule, isRequestHeaders);
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
     * @param isRequestHeaders Is request headers.
     * @returns True if rule is applicable.
     */
    private static isApplicableRemoveHeaderRule(
        headers: WebRequest.HttpHeadersItemType[],
        rule: NetworkRule,
        isRequestHeaders: boolean,
    ): boolean {
        const headerName = HeadersService.getApplicableHeaderName(rule, isRequestHeaders);
        if (!headerName) {
            return false;
        }

        return !!findHeaderByName(headers, headerName);
    }

    /**
     * Returns header name if rule has remove header modifier and it is applicable.
     *
     * @param rule Rule with $removeheader modifier.
     * @param isRequestHeaders Is request headers.
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

export const removeHeadersService = new RemoveHeadersService(defaultFilteringLog);
