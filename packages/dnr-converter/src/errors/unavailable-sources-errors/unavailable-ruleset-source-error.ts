/**
 * Describes an error when rule set source is not available.
 */
export class UnavailableRulesetSourceError extends Error {
    /**
     * Rule set id, the source of which is not available.
     */
    rulesetId: string;

    /**
     * Describes an error when rule set source is not available.
     *
     * @param message Message of error.
     * @param rulesetId Rule set id, the source of which is not available.
     * @param cause Basic error, describes why the source is unavailable.
     */
    constructor(
        message: string,
        rulesetId: string,
        cause?: Error,
    ) {
        super(message, { cause });

        this.name = this.constructor.name;
        this.rulesetId = rulesetId;

        // For proper work of the "instanceof" operator
        Object.setPrototypeOf(this, UnavailableRulesetSourceError.prototype);
    }
}
