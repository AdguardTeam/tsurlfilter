/**
 * @file MetadataRuleset class for managing and serializing metadata rulesets.
 *
 * A metadata ruleset stores checksums and additional properties for a
 * collection of DNR rulesets. It serializes to a JSON array of metadata
 * rules whose `metadata.chunk` fragments, joined in order, form the payload
 * `{ checksums, additionalProperties }`.
 */

import * as v from 'valibot';

import { getRulesetId } from '../utils/ruleset-utils';
import { serializeJson } from '../utils/string';

import { MetadataRules } from './metadata-rule';

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
 * Metadata validator. Uses `v.strictObject` so unknown payload keys are
 * rejected at deserialization time.
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
 * Represents a specialized metadata ruleset for managing and validating
 * metadata associated with various rulesets.
 *
 * This class handles checksums and additional properties, providing methods
 * to manipulate and query this metadata.
 */
export class MetadataRuleset {
    /**
     * Checksums and additional properties.
     */
    private metadata: Metadata;

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
        this.metadata = {
            checksums: { ...checksums },
            additionalProperties: { ...additionalProperties },
        };
    }

    /**
     * Returns rule set id.
     *
     * @returns Rule set id.
     */
    // Note: we prefer `instance.getId()` over `MetadataRuleset.getId(instance)` for consistency.
    // eslint-disable-next-line class-methods-use-this
    public getId(): string {
        return getRulesetId(METADATA_RULESET_ID);
    }

    /**
     * Sets checksum for the specified rule set.
     *
     * @param rulesetId Rule set id.
     * @param checksum Checksum.
     */
    public setChecksum(rulesetId: string, checksum: string): void {
        this.metadata.checksums[rulesetId] = checksum;
    }

    /**
     * Returns checksum for the specified rule set.
     *
     * @param rulesetId Rule set id.
     *
     * @returns Checksum or undefined if not found.
     */
    public getChecksum(rulesetId: string): string | undefined {
        return this.metadata.checksums[rulesetId];
    }

    /**
     * Returns all rule set ids in the metadata.
     *
     * @returns Rule set ids.
     */
    public getRulesetIds(): string[] {
        return Object.keys(this.metadata.checksums);
    }

    /**
     * Gets additional property.
     *
     * @param key Property key.
     *
     * @returns Property value or undefined if not found.
     */
    public getAdditionalProperty(key: string): unknown {
        return this.metadata.additionalProperties[key];
    }

    /**
     * Sets additional property.
     *
     * @param key Property key.
     * @param value Property value. The class does not validate that the value is
     * JSON-serializable; callers are responsible for ensuring serializability.
     */
    public setAdditionalProperty(key: string, value: unknown): void {
        this.metadata.additionalProperties[key] = value;
    }

    /**
     * Checks whether additional property exists.
     *
     * @param key Property key.
     *
     * @returns Whether the property exists.
     */
    public hasAdditionalProperty(key: string): boolean {
        return Object.hasOwn(this.metadata.additionalProperties, key);
    }

    /**
     * Removes additional property.
     *
     * @param key Property key.
     */
    public removeAdditionalProperty(key: string): void {
        delete this.metadata.additionalProperties[key];
    }

    /**
     * Serializes the ruleset to a string: a JSON array of metadata rules
     * carrying the payload in `metadata.chunk` fragments.
     *
     * @param pretty Whether to prettify the output.
     *
     * @returns Serialized ruleset.
     */
    public serialize(pretty = false): string {
        // The metadata ruleset has no ordinary rules, so no ids are taken.
        const rules = MetadataRules.create(this.metadata, new Set(), pretty);

        return serializeJson(rules, pretty);
    }

    /**
     * Deserializes the ruleset from a string.
     *
     * @param rawJson Serialized ruleset.
     *
     * @returns Deserialized ruleset.
     *
     * @throws {SyntaxError} If `rawJson` is not valid JSON.
     * @throws {InvalidMetadataChunksError} If the metadata rules are missing
     * or malformed.
     * @throws {ValiError} If the payload fails schema validation.
     */
    public static deserialize(rawJson: string): MetadataRuleset {
        const rulesetId = getRulesetId(METADATA_RULESET_ID);

        const { payload } = MetadataRules.read(rulesetId, JSON.parse(rawJson));

        const { checksums, additionalProperties } = v.parse(metadataValidator, payload);

        return new MetadataRuleset(checksums, additionalProperties);
    }
}
