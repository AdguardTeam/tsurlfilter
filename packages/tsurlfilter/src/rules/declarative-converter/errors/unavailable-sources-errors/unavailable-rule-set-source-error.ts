/**
 * Describes an error when rule set source is not available.
 */
export class UnavailableRuleSetSourceError extends Error {
    ruleSetId: string;

    /**
     * Describes an error when rule set source is not available.
     *
     * @param message Message of error.
     * @param ruleSetId Rule set id, the source of which is not available.
     * @param cause Basic error, describes why the source is unavailable.
     */
    constructor(
        message: string,
        ruleSetId: string,
        cause?: Error,
    ) {
        super(message, { cause });

        this.name = this.constructor.name;
        this.ruleSetId = ruleSetId;

        // For proper work of the "instanceof" operator
        Object.setPrototypeOf(this, UnavailableRuleSetSourceError.prototype);
    }
}
