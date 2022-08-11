import { nanoid } from 'nanoid';
import { WebRequest } from 'webextension-polyfill';
import { NetworkRule, RemoveHeaderModifier } from '@adguard/tsurlfilter';
import {
    defaultFilteringLog,
    FilteringEventType,
    FilteringLogInterface,
    getDomain,
} from '../../../common';
import { removeHeader } from '../utils/headers';
import { RequestContext, requestContextStorage } from '../request';

/**
 * Headers filtering service module
 */
export class HeadersService {
    private filteringLog: FilteringLogInterface;

    /**
     * Constructor
     *
     * @param filteringLog
     */
    constructor(filteringLog: FilteringLogInterface) {
        this.filteringLog = filteringLog;
    }

    /**
     * On before send headers handler.
     * Removes request headers.
     *
     * @param context request context
     * @return if headers modified
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
        rules.forEach((rule) => {
            if (HeadersService.applyRule(requestHeaders, rule, true)) {
                isModified = true;
                this.filteringLog.publishEvent({
                    type: FilteringEventType.REMOVE_HEADER,
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
     * Remove response headers.
     *
     * @param context request context
     * @return if headers modified
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
            if (HeadersService.applyRule(responseHeaders, rule, false)) {
                isModified = true;
                this.filteringLog.publishEvent({
                    type: FilteringEventType.REMOVE_HEADER,
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
     * Applies rule to headers
     *
     * @param headers
     * @param rule
     * @param isRequestHeaders
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

export const headersService = new HeadersService(defaultFilteringLog);
