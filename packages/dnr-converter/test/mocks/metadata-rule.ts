import { expect } from 'vitest';

import { MAX_METADATA_VALUE_BYTES, MetadataChunks } from '../../src/ruleset/metadata-chunks';

/**
 * Metadata rule as it appears in a parsed ruleset file.
 */
type MetadataRuleMock = {
    /**
     * Rule id.
     */
    id: number;

    /**
     * Rule action.
     */
    action: {
        /**
         * Action type.
         */
        type: string;
    };

    /**
     * Rule condition carrying the metadata rule marker.
     */
    condition: {
        /**
         * Marker URL of metadata rules.
         */
        urlFilter: string;

        /**
         * Resource types of the dummy condition.
         */
        resourceTypes: string[];
    };

    /**
     * Value of the `metadata` property.
     */
    metadata: unknown;
};

/**
 * Creates a metadata rule as it appears in a parsed ruleset file, carrying
 * the given `metadata` value.
 *
 * @param metadata Value of the `metadata` property, e.g. `{ chunk: '...' }`
 * or a 1.x payload.
 * @param id Rule id.
 *
 * @returns Metadata rule object.
 */
export function createMetadataRuleMock(metadata: unknown, id = 1): MetadataRuleMock {
    return {
        id,
        action: { type: 'block' },
        condition: {
            urlFilter: 'dummy.rule.adguard.com',
            resourceTypes: ['xmlhttprequest'],
        },
        metadata,
    };
}

/**
 * Asserts that every `metadata` value of the leading metadata rules of a
 * serialized ruleset file is within {@link MAX_METADATA_VALUE_BYTES} and
 * appears in the file exactly as {@link MetadataChunks.renderValue} renders it.
 *
 * @param json Serialized ruleset file.
 * @param pretty Whether the file is pretty printed.
 */
export function expectMetadataValuesWithinBound(json: string, pretty: boolean): void {
    const rules = JSON.parse(json) as { metadata?: { chunk?: unknown } }[];
    let checked = 0;

    for (const rule of rules) {
        const chunk = rule.metadata?.chunk;

        if (typeof chunk !== 'string') {
            break;
        }

        const value = MetadataChunks.renderValue(chunk, pretty);

        expect(MetadataChunks.utf8ByteLength(value)).toBeLessThanOrEqual(MAX_METADATA_VALUE_BYTES);
        expect(json).toContain(value);
        checked += 1;
    }

    expect(checked).toBeGreaterThan(0);
}
