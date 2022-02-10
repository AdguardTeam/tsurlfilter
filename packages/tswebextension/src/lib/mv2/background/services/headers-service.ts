import { WebRequest } from 'webextension-polyfill';
import { NetworkRule, RemoveHeaderModifier } from '@adguard/tsurlfilter';
import { FilteringLog, defaultFilteringLog } from '../../../common';
import { removeHeader } from '../utils/headers';
import { RequestData } from '../request/events/request-event';

/**
 * Headers filtering service module
 */
export class HeadersService {
    private filteringLog: FilteringLog;

    /**
     * Constructor
     *
     * @param filteringLog
     */
    constructor(filteringLog: FilteringLog) {
        this.filteringLog = filteringLog;
    }

    /**
     * On before send headers handler.
     * Removes request headers.
     *
     * @param data request data
     * @return if headers modified
     */
    public onBeforeSendHeaders(data: RequestData<WebRequest.OnBeforeSendHeadersDetailsType>): boolean {
        if (!data.details.requestHeaders) {
            return false;
        }

        if (!data.context?.matchingResult) {
            return false;
        }

        const rules = data.context!.matchingResult!.getRemoveHeaderRules();
        if (rules.length === 0) {
            return false;
        }

        let result = false;
        rules.forEach((rule) => {
            if (HeadersService.applyRule(data.details.requestHeaders!, rule, true)) {
                result = true;
                this.filteringLog.addRemoveHeaderEvent({
                    tabId: data.details.tabId,
                    frameUrl: data.details.url,
                    headerName: rule.getAdvancedModifierValue()!,
                    rule,
                });
            }
        });

        return result;
    }

    /**
     * On headers received handler.
     * Remove response headers.
     *
     * @param data request data
     * @return if headers modified
     */
    public onHeadersReceived(data: RequestData<WebRequest.OnHeadersReceivedDetailsType>): boolean {
        if (!data.details.responseHeaders) {
            return false;
        }

        if (!data.context?.matchingResult) {
            return false;
        }

        const rules = data.context!.matchingResult!.getRemoveHeaderRules();
        if (rules.length === 0) {
            return false;
        }

        let result = false;
        rules.forEach((rule) => {
            if (HeadersService.applyRule(data.details.responseHeaders!, rule, false)) {
                result = true;
                this.filteringLog.addRemoveHeaderEvent({
                    tabId: data.details.tabId,
                    frameUrl: data.details.url,
                    headerName: rule.getAdvancedModifierValue()!,
                    rule,
                });
            }
        });

        return result;
    }

    /**
     * Applies rule to headers
     *
     * @param headers
     * @param rule
     * @param isRequestHeaders
     */
    private static applyRule(
        headers: WebRequest.HttpHeadersItemType[], rule: NetworkRule, isRequestHeaders: boolean,
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
