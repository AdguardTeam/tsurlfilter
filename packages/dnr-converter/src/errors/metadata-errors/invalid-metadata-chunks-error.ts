/**
 * Describes an error when the metadata rules of a serialized ruleset are
 * missing, malformed or do not form valid JSON.
 */
export class InvalidMetadataChunksError extends Error {
    /**
     * Rule set id whose metadata could not be read.
     */
    rulesetId: string;

    /**
     * Describes an error when the metadata rules of a serialized ruleset
     * cannot be read. The message names the rule set and the reason.
     *
     * @param rulesetId Rule set id whose metadata could not be read.
     * @param reason Why the metadata cannot be read.
     * @param cause Basic error, describes why the metadata is unreadable.
     */
    constructor(
        rulesetId: string,
        reason: string,
        cause?: Error,
    ) {
        super(`Cannot read metadata of rule set '${rulesetId}': ${reason}`, { cause });

        this.name = this.constructor.name;
        this.rulesetId = rulesetId;

        // For proper work of the "instanceof" operator
        Object.setPrototypeOf(this, InvalidMetadataChunksError.prototype);
    }
}
