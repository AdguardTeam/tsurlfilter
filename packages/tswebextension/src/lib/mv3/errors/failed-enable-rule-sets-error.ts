/**
 * Describes error when enabled static rule sets has been failed.
 */
export class FailedEnableRuleSetsError extends Error {
    /**
     * A list of the IDs of the rule sets that were attempted to enable.
     */
    enableRulesetIds: string[];

    /**
     * A list of the IDs of the rule sets that were attempted to disable.
     */
    disableRulesetIds: string[];

    /**
     * Describes error when enabled static rule sets has been failed.
     *
     * @param message Message of error.
     * @param enableRulesetIds A list of the IDs of the rule sets that were
     * attempted to enable.
     * @param disableRulesetIds A list of the IDs of the rule sets that were
     * attempted to disable.
     * @param cause Specific chrome.declarativeNetRequest error.
     */
    constructor(
        message: string,
        enableRulesetIds: string[],
        disableRulesetIds: string[],
        cause?: Error,
    ) {
        super(message, { cause });

        this.name = 'FailedEnableRuleSetsError';

        this.enableRulesetIds = enableRulesetIds;
        this.disableRulesetIds = disableRulesetIds;

        // For proper work of the "instanceof" operator
        Object.setPrototypeOf(this, FailedEnableRuleSetsError.prototype);
    }
}
