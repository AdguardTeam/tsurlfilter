import { NetworkRule } from './rules/network-rule';

export interface CookieEventOptions {
    tabId: number;
    cookieName: string;
    cookieValue: string;
    cookieDomain: string;
    cookieRule: NetworkRule;
    isModifyingCookieRule: boolean;
    thirdParty: boolean;
    timestamp: number;
}

/**
 * Filtering log interface
 */
export interface FilteringLog {

    /**
     * Add cookie rule event
     *
     * @param options
     */
    addCookieEvent(options: CookieEventOptions): void;

    /**
     * Add header removed event
     *
     * @param tabId
     * @param frameUrl
     * @param headerName
     * @param rule
     */
    addRemoveHeaderEvent(
        tabId: number,
        frameUrl: string,
        headerName: string,
        rule: NetworkRule,
    ): void;
}
