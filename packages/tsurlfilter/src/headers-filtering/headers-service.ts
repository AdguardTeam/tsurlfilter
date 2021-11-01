import { WebRequest } from 'webextension-polyfill';
import { FilteringLog } from '../filtering-log';
import { NetworkRule } from '../rules/network-rule';
import { RemoveHeaderModifier } from '../modifiers/remove-header-modifier';
import OnBeforeSendHeadersDetailsType = WebRequest.OnBeforeSendHeadersDetailsType;
import OnHeadersReceivedDetailsType = WebRequest.OnHeadersReceivedDetailsType;
import HttpHeadersItemType = WebRequest.HttpHeadersItemType;
import { removeHeader } from '../utils/headers';

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
     * @param details
     * @param rules
     * @return if headers modified
     */
    public onBeforeSendHeaders(details: OnBeforeSendHeadersDetailsType, rules: NetworkRule[]): boolean {
        if (!details.requestHeaders) {
            return false;
        }

        if (rules.length === 0) {
            return false;
        }

        let result = false;
        rules.forEach((rule) => {
            if (HeadersService.applyRule(details.requestHeaders!, rule, true)) {
                result = true;
                this.filteringLog.addRemoveHeaderEvent(
                    details.tabId, details.url, rule.getAdvancedModifierValue()!, rule,
                );
            }
        });

        return result;
    }

    /**
     * On headers received handler.
     * Remove response headers.
     *
     * @param details
     * @param rules
     * @return if headers modified
     */
    public onHeadersReceived(details: OnHeadersReceivedDetailsType, rules: NetworkRule[]): boolean {
        if (!details.responseHeaders) {
            return false;
        }

        if (rules.length === 0) {
            return false;
        }

        let result = false;
        rules.forEach((rule) => {
            if (HeadersService.applyRule(details.responseHeaders!, rule, false)) {
                result = true;
                this.filteringLog.addRemoveHeaderEvent(
                    details.tabId, details.url, rule.getAdvancedModifierValue()!, rule,
                );
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
    private static applyRule(headers: HttpHeadersItemType[], rule: NetworkRule, isRequestHeaders: boolean): boolean {
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
