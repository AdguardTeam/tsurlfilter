/**
 * @file MetadataRuleset class for managing and serializing metadata rulesets.
 *
 * A metadata ruleset stores checksums and additional properties for a
 * collection of DNR rulesets. It serializes to a JSON array containing a
 * single declarative rule with a `metadata` field.
 */

import * as v from 'valibot';

import { FilterConverter } from '../filter-converter/filter-converter';
import { serializeJson } from '../utils/string';

import { createMetadataRule, type MetadataRule } from './metadata-rule';

/**
 * Metadata ruleset ID.
 */
export const METADATA_RULESET_ID = 0;

/**
 * Checksum map validator.
 */
const checksumMapValidator = v.record(v.string(), v.string());

/**
 * Checksum map type.
 */
type ChecksumMap = v.InferOutput<typeof checksumMapValidator>;

/**
 * Metadata validator.
 */
const metadataValidator = v.strictObject({
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
    additionalProperties: v.record(v.string(), v.unknown()),
});

/**
 * Metadata type.
 */
type Metadata = v.InferOutput<typeof metadataValidator>;

/**
 * Metadata rule validator.
 *
 * @note We use `v.looseObject` to allow additional fields in the object
 * (equivalent of Zod's `.passthrough()`).
 */
const metadataRuleValidator = v.looseObject({
    metadata: metadataValidator,
});

/**
 * Represents a specialized metadata ruleset for managing and validating
 * metadata associated with various rulesets.
 *
 * This class handles checksums and additional properties, providing methods
 * to manipulate and query this metadata.
 */
export class MetadataRuleset {
    /**
     * The underlying metadata rule holding checksums and additional properties.
     */
    private metadataRule: MetadataRule<Metadata>;

    /**
     * Creates an instance of the MetadataRuleset class.
     *
     * @param checksums A map of checksums, where each key corresponds to a
     * rule set ID and each value is the checksum for that ruleset.
     * Defaults to an empty object.
     * @param additionalProperties A collection of additional properties, where
     * keys are property names and values are their associated data. These
     * properties are JSON serializable but not validated by the class.
     * Defaults to an empty object.
     *
     * @note
     * Inputs are shallow-cloned so the instance owns its internal state.
     */
    constructor(
        checksums: ChecksumMap = {},
        additionalProperties: Record<string, unknown> = {},
    ) {
        this.metadataRule = createMetadataRule({
            checksums: { ...checksums },
            additionalProperties: { ...additionalProperties },
        });
    }

    /**
     * Returns rule set id.
     *
     * @returns Rule set id.
     */
    // Note: we prefer `instance.getId()` over `MetadataRuleset.getId(instance)` for consistency.
    // eslint-disable-next-line class-methods-use-this
    public getId(): string {
        return FilterConverter.getRuleSetId(METADATA_RULESET_ID);
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
    public getAdditionalProperty(key: string): unknown {
        return this.metadataRule.metadata.additionalProperties[key];
    }

    /**
     * Sets additional property.
     *
     * @param key Property key.
     * @param value Property value. The class does not validate that the value is
     * JSON-serializable; callers are responsible for ensuring serializability.
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
        return Object.hasOwn(this.metadataRule.metadata.additionalProperties, key);
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
    public static deserialize(rawJson: string): MetadataRuleset {
        const parsed: unknown = JSON.parse(rawJson);

        if (!Array.isArray(parsed) || parsed.length !== 1) {
            throw new Error('Invalid input: expected a single-element array.');
        }

        const {
            metadata: {
                checksums,
                additionalProperties,
            },
        } = v.parse(metadataRuleValidator, parsed[0]);

        return new MetadataRuleset(checksums, additionalProperties);
    }
}
