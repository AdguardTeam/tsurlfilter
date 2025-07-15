import * as z from 'zod';

import { serializeJson } from '../../utils/misc';
import { isNonEmptyArray } from '../../utils/guards';
import { getRuleSetId } from '../declarative-converter-utils';

import { createMetadataRule, type MetadataRule } from './metadata-rule';

/**
 * Metadata ruleset ID.
 */
export const METADATA_RULESET_ID = 0;

/**
 * Checksum map validator.
 */
const checksumMapValidator = z.record(z.string());

/**
 * Checksum map.
 */
type ChecksumMap = z.infer<typeof checksumMapValidator>;

/**
 * Metadata validator.
 */
const metadataValidator = z.object({
    /**
     * Checksums for all rulesets.
     */
    checksums: checksumMapValidator,

    /**
     * Additional properties.
     * This field stores any extra information not covered by the other fields.
     * The content of this field is not validated, but it must be JSON serializable.
     * Validation should be performed by users.
     */
    additionalProperties: z.record(z.unknown()),
});

/**
 * Metadata rule validator.
 *
 * @note We use `passthrough` method to allow additional fields in the object.
 */
const metadataRuleValidator = z.object({
    metadata: metadataValidator,
}).passthrough();

/**
 * Metadata type.
 */
type Metadata = z.infer<typeof metadataValidator>;

/**
 * Represents a specialized metadata ruleset for managing and validating metadata associated
 * with various rulesets.
 *
 * This class handles byte range maps, checksums, and additional properties,
 * providing methods to manipulate and query this metadata.
 */
export class MetadataRuleSet {
    private metadataRule: MetadataRule<Metadata>;

    /**
     * Creates an instance of the MetadataRuleSet class.
     *
     * @param checksums A map of checksums, where each key corresponds to a rule set ID and each value is the checksum
     * for that ruleset. Defaults to an empty object.
     * @param additionalProperties A collection of additional properties, where keys are property names and values are
     * their associated data. These properties are JSON serializable but not validated by the class.
     * Defaults to an empty object.
     *
     * @note
     * This constructor uses references for the provided arguments. If immutability is required, ensure to clone the
     * inputs before passing them.
     *
     * @todo TODO: Consider mark `checksums` and `additionalProperties` as required parameters.
     * For deserialization - add static method which will create an instance
     * with deserialized checksums and additional properties via constructor,
     * and get them stronger types.
     */
    constructor(
        checksums: ChecksumMap = {},
        additionalProperties: Record<string, unknown> | undefined = {},
    ) {
        this.metadataRule = createMetadataRule({
            byteRangeMapsCollection: {},
            checksums,
            additionalProperties: additionalProperties ?? {},
        });
    }

    /**
     * Returns rule set id.
     *
     * @returns Rule set id.
     */
    // Note: we prefer `instance.getId()` over `MetadataRuleSet.getId(instance)` for consistency.
    // eslint-disable-next-line class-methods-use-this
    public getId(): string {
        return getRuleSetId(METADATA_RULESET_ID);
    }

    /**
     * Sets checksum for the specified rule set.
     *
     * @param ruleSetId Rule set id.
     * @param checksum Checksum.
     */
    public setChecksum(ruleSetId: string, checksum: string): void {
        this.metadataRule.metadata.checksums[ruleSetId] = checksum;
    }

    /**
     * Returns checksum for the specified rule set.
     *
     * @param ruleSetId Rule set id.
     *
     * @returns Checksum or undefined if not found.
     */
    public getChecksum(ruleSetId: string): string | undefined {
        return this.metadataRule.metadata.checksums[ruleSetId];
    }

    /**
     * Returns all rule set ids in the metadata.
     *
     * @returns Rule set ids.
     */
    public getRuleSetIds(): string[] {
        return Object.keys(this.metadataRule.metadata.checksums);
    }

    /**
     * Gets additional property.
     *
     * @param key Property key.
     *
     * @returns Property value or undefined if not found.
     */
    public getAdditionalProperty(key: string): unknown | undefined {
        return this.metadataRule.metadata.additionalProperties[key];
    }

    /**
     * Sets additional property.
     *
     * @param key Property key.
     * @param value Property value. Should be JSON serializable.
     */
    public setAdditionalProperty(key: string, value: unknown): void {
        this.metadataRule.metadata.additionalProperties[key] = value;
    }

    /**
     * Checks whether additional property exists.
     *
     * @param key Property key.
     *
     * @returns Whether the property exists.
     */
    public hasAdditionalProperty(key: string): boolean {
        return key in this.metadataRule.metadata.additionalProperties;
    }

    /**
     * Removes additional property.
     *
     * @param key Property key.
     */
    public removeAdditionalProperty(key: string): void {
        delete this.metadataRule.metadata.additionalProperties[key];
    }

    /**
     * Serializes the ruleset to a string.
     *
     * @param pretty Whether to prettify the output.
     *
     * @returns Serialized ruleset.
     */
    public serialize(pretty = false): string {
        return serializeJson([this.metadataRule], pretty);
    }

    /**
     * Deserializes the ruleset from a string.
     *
     * @param rawJson Serialized ruleset.
     *
     * @returns Deserialized ruleset.
     *
     * @throws Error if the input is invalid.
     */
    public static deserialize(rawJson: string): MetadataRuleSet {
        const parsed = JSON.parse(rawJson);

        if (!isNonEmptyArray(parsed)) {
            throw new Error('Invalid input: expected a non-empty array.');
        }

        const {
            metadata: {
                checksums,
                additionalProperties,
            },
        } = metadataRuleValidator.parse(parsed[0]);

        const ruleSet = new MetadataRuleSet(checksums, additionalProperties);

        return ruleSet;
    }
}
