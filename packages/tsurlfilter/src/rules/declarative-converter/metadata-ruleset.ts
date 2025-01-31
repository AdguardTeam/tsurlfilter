import * as z from 'zod';

import { serializeJson } from '../../utils/misc';
import { type ByteRange, byteRangeValidator } from '../../utils/byte-range';
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
 * Byte range map validator.
 */
const byteRangeMapValidator = z.record(byteRangeValidator);

/**
 * Byte range map.
 */
export type ByteRangeMap = z.infer<typeof byteRangeMapValidator>;

/**
 * Byte range map collection validator.
 */
const byteRangeMapCollectionValidator = z.record(byteRangeMapValidator);

/**
 * Byte range map collection.
 */
type ByteRangeMapCollection = z.infer<typeof byteRangeMapCollectionValidator>;

/**
 * Metadata validator.
 */
const metadataValidator = z.object({
    /**
     * Byte range maps collection for all rulesets.
     */
    byteRangeMapsCollection: byteRangeMapCollectionValidator,

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
     * @param byteRangeMapsCollection A map of byte range maps, where each key corresponds to a ruleset ID
     * and each value is a map of byte ranges for that ruleset. Defaults to an empty object.
     * @param checksums A map of checksums, where each key corresponds to a rule set ID and each value is the checksum
     * for that ruleset. Defaults to an empty object.
     * @param additionalProperties A collection of additional properties, where keys are property names and values are
     * their associated data. These properties are JSON serializable but not validated by the class.
     * Defaults to an empty object.
     *
     * @note
     * This constructor uses references for the provided arguments. If immutability is required, ensure to clone the
     * inputs before passing them.
     */
    constructor(
        byteRangeMapsCollection: ByteRangeMapCollection = {},
        checksums: ChecksumMap = {},
        additionalProperties: Record<string, unknown> | undefined = {},
    ) {
        this.metadataRule = createMetadataRule({
            byteRangeMapsCollection,
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
     * Sets byte range map for the specified rule set.
     *
     * @param ruleSetId Rule set id.
     * @param byteRangeMap Byte range map.
     */
    public setByteRangeMap(ruleSetId: string, byteRangeMap: ByteRangeMap): void {
        this.metadataRule.metadata.byteRangeMapsCollection[ruleSetId] = byteRangeMap;
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
     * Returns byte range map for the specified rule set.
     *
     * @param ruleSetId Rule set id.
     *
     * @returns Byte range map or undefined if not found.
     */
    public getByteRangeMap(ruleSetId: string): ByteRangeMap | undefined {
        return this.metadataRule.metadata.byteRangeMapsCollection[ruleSetId];
    }

    /**
     * Gets the byte range for the specified rule set and category.
     *
     * @param rulesetId Rule set id.
     * @param category Byte range category, see {@link RuleSetByteRangeCategory}.
     *
     * @returns Byte range for the specified rule set and category.
     *
     * @throws Error if the byte range map for the specified rule set is not found
     * or the byte range for the specified category is not found.
     */
    public getByteRange(rulesetId: string, category: string): ByteRange {
        const byteRangeMap = this.getByteRangeMap(rulesetId);

        if (!byteRangeMap) {
            throw new Error(`Byte range map for rule set ${rulesetId} not found`);
        }

        const range = byteRangeMap[category];

        if (!range) {
            throw new Error(`Byte range for category ${category} not found in rule set ${rulesetId}`);
        }

        return range;
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
        return Object.keys(this.metadataRule.metadata.byteRangeMapsCollection);
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
                byteRangeMapsCollection,
                checksums,
                additionalProperties,
            },
        } = metadataRuleValidator.parse(parsed[0]);

        const ruleSet = new MetadataRuleSet(byteRangeMapsCollection, checksums, additionalProperties);

        return ruleSet;
    }
}
