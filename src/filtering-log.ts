import { CosmeticRule } from './rules/cosmetic-rule';
import { NetworkRule } from './rules/network-rule';
import { RequestType } from './request-type';

/**
 * Filtering log interface
 */
export interface FilteringLog {
    /**
     * Add html rule event to log
     *
     * @param {Number} tabId - tab id
     * @param {String} elementString - element string presentation
     * @param {String} frameUrl - Frame url
     * @param {CosmeticRule} rule - rule
     */
    addHtmlEvent(tabId: number, elementString: string, frameUrl: string, rule: CosmeticRule): void;

    /**
     * Add html rule event to log
     *
     * @param {Number} tabId - tab id
     * @param {String} frameUrl - Frame url
     * @param {NetworkRule[]} rules - cookie rule
     */
    addReplaceRulesEvent(tabId: number, frameUrl: string, rules: NetworkRule[]): void;

    /**
     * Add cookie rule event
     *
     * @param tabId
     * @param cookieName
     * @param cookieValue
     * @param cookieDomain
     * @param requestType
     * @param cookieRule
     * @param isModifyingCookieRule
     * @param thirdParty
     */
    addCookieEvent(
        tabId: number,
        cookieName: string,
        cookieValue: string,
        cookieDomain: string,
        requestType: RequestType,
        cookieRule: NetworkRule,
        isModifyingCookieRule: boolean,
        thirdParty: boolean): void;

    /**
     * Add header removed event
     *
     * @param tabId
     * @param headerName
     * @param rule
     */
    addRemoveHeaderEvent(
        tabId: number,
        headerName: string,
        rule: NetworkRule,
    ): void;
}
