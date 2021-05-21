/**
 * Content modifications listener
 */
export class ModificationsListener {
    /**
     * Filtering log
     */
    filteringLog;

    /**
     * Constructor
     */
    constructor(filteringLog) {
        this.filteringLog = filteringLog;
    }

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
    onHtmlRuleApplied(tabId, requestId, elementString, frameUrl, rule) {
        this.filteringLog.addHtmlEvent(tabId, elementString, frameUrl, rule);
    }

    /**
     * On replace rules applied
     *
     * @param {Number} tabId - tab id
     * @param {Number} requestId - request id
     * @param {String} frameUrl - Frame url
     * @param {NetworkRule[]} rules - cookie rule
     */
    onReplaceRulesApplied(tabId, requestId, frameUrl, rules) {
        this.filteringLog.addReplaceRulesEvent(tabId, frameUrl, rules);
    }

    /**
     * On modification started
     *
     * @param requestId
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars,class-methods-use-this
    onModificationStarted(requestId) {
        // Do nothing
    }

    /**
     * On modification completed
     *
     * @param requestId
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars,class-methods-use-this
    onModificationFinished(requestId) {
        // Do nothing
    }
}
