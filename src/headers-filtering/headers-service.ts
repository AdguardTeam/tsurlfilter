import { WebRequest } from 'webextension-polyfill-ts';
import { FilteringLog } from '../filtering-log';
import { NetworkRule } from '../rules/network-rule';
import { RemoveHeaderModifier } from '../modifiers/remove-header-modifier';
import OnBeforeSendHeadersDetailsType = WebRequest.OnBeforeSendHeadersDetailsType;
import OnHeadersReceivedDetailsType = WebRequest.OnHeadersReceivedDetailsType;
import HttpHeadersItemType = WebRequest.HttpHeadersItemType;

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
     */
    public onBeforeSendHeaders(details: OnBeforeSendHeadersDetailsType, rules: NetworkRule[]): void {
        if (!details.requestHeaders) {
            return;
        }

        if (rules.length === 0) {
            return;
        }

        rules.forEach((rule) => {
            if (HeadersService.applyRule(details.requestHeaders!, rule, true)) {
                this.filteringLog.addRemoveHeaderEvent(details.tabId, rule.getAdvancedModifierValue()!, rule);
            }
        });
    }

    /**
     * On headers received handler.
     * Remove response headers.
     *
     * @param details
     * @param rules
     */
    public onHeadersReceived(details: OnHeadersReceivedDetailsType, rules: NetworkRule[]): void {
        if (!details.responseHeaders) {
            return;
        }

        if (rules.length === 0) {
            return;
        }

        rules.forEach((rule) => {
            if (HeadersService.applyRule(details.responseHeaders!, rule, false)) {
                this.filteringLog.addRemoveHeaderEvent(details.tabId, rule.getAdvancedModifierValue()!, rule);
            }
        });
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

        return modifier.apply(headers, isRequestHeaders);
    }
}
