import { CosmeticRule } from '../rules/cosmetic-rule';
import { NetworkRule } from '../rules/network-rule';

/**
 * Content modifications listener
 */
export interface ModificationsListener {
    /**
     * On html rule applied
     *
     * @param {Number} tabId - tab id
     * @param {Number} requestId - request id
     * @param {String} elementString - element string presentation
     * @param {String} frameUrl - Frame url
     * @param {CosmeticRule} rule - rule
     */
    // eslint-disable-next-line max-len
    onHtmlRuleApplied(tabId: number, requestId: number, elementString: string, frameUrl: string, rule: CosmeticRule): void;

    /**
     * On replace rules applied
     *
     * @param {Number} tabId - tab id
     * @param {Number} requestId - request id
     * @param {String} frameUrl - Frame url
     * @param {NetworkRule[]} rules - cookie rule
     */
    onReplaceRulesApplied(tabId: number, requestId: number, frameUrl: string, rules: NetworkRule[]): void;

    /**
     * On modification started
     *
     * @param requestId
     */
    onModificationStarted(requestId: number): void;

    /**
     * On modification completed
     *
     * @param requestId
     */
    onModificationFinished(requestId: number): void;
}
