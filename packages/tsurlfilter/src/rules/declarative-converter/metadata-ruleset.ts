import { z } from 'zod';

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
    byteRangeMapsCollection: byteRangeMapCollectionValidator,
    checksums: checksumMapValidator,
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
 * Metadata rule set.
 * Its a special rule set that contains only one rule - metadata rule, that holds metadata for all other rulesets.
 */
export class MetadataRuleSet {
    private metadataRule: MetadataRule<Metadata>;

    /**
     * Constructor.
     *
     * @param byteRangeMapsCollection Byte range maps collection. Default is an empty object.
     * @param checksums Checksums. Default is an empty object.
     *
     * @note It takes values by reference. If ever needed, clone them before passing.
     */
    constructor(
        byteRangeMapsCollection: ByteRangeMapCollection = {},
        checksums: ChecksumMap = {},
    ) {
        this.metadataRule = createMetadataRule({
            byteRangeMapsCollection,
            checksums,
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

        const { metadata: { byteRangeMapsCollection, checksums } } = metadataRuleValidator.parse(parsed[0]);

        const ruleSet = new MetadataRuleSet(byteRangeMapsCollection, checksums);

        return ruleSet;
    }
}
