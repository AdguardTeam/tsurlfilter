import { nanoid } from 'nanoid';
import { WebRequest } from 'webextension-polyfill';
import { NetworkRule, NetworkRuleOption, RemoveHeaderModifier } from '@adguard/tsurlfilter';

import {
    defaultFilteringLog,
    FilteringEventType,
    FilteringLogInterface,
    getDomain,
} from '../../../common';
import { removeHeader } from '../utils/headers';
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
            if (RemoveHeadersService.applyRule(requestHeaders, rule, true)) {
                isModified = true;
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

        rules.forEach((rule: NetworkRule) => {
            if (rule.isOptionEnabled(NetworkRuleOption.Header)) {
                const responseHeaderMatch = rule.matchResponseHeaders(responseHeaders);
                if (!responseHeaderMatch || rule.isAllowlist()) {
                    return;
                }
            }
            if (RemoveHeadersService.applyRule(responseHeaders, rule, false)) {
                isModified = true;
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
        const modifier = rule.getAdvancedModifier() as RemoveHeaderModifier;
        if (!modifier) {
            return false;
        }

        const headerName = modifier.getApplicableHeaderName(isRequestHeaders);
        if (!headerName) {
            return false;
        }

        return removeHeader(headers, headerName);
    }
}

export const removeHeadersService = new RemoveHeadersService(defaultFilteringLog);
