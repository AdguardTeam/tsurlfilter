import { NetworkRule } from '@adguard/tsurlfilter';

/**
 * Filtering log interface
 */
export interface FilteringLog {

    /**
     * Add cookie rule event
     *
     * @param options
     */
    addCookieEvent(options: {
        tabId: number;
        cookieName: string;
        cookieValue: string;
        cookieDomain: string;
        cookieRule: NetworkRule;
        isModifyingCookieRule: boolean;
        thirdParty: boolean;
        timestamp: number;
    }): void;

    /**
     * Add header removed event
     *
     * @param tabId
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
