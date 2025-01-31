/**
 * @file Utility functions for working with metadata rules.
 *
 * Metadata rules are declarative rules that do not block anything themselves,
 * but contain additional information. This information is used by the extension to process other rules,
 * conversion maps, and source maps.
 */

import { type DeclarativeRule, ResourceType, RuleActionType } from './declarative-rule';

/**
 * Metadata rule ID. Always the first rule in the rule set.
 */
const METADATA_RULE_ID = 1 as const;

/**
 * Metadata key in the rule object.
 */
const METADATA_KEY = 'metadata';

/**
 * Dummy rule URL that should not match any request.
 */
const DUMMY_RULE_URL = 'dummy.rule.adguard.com';

/**
 * Base metadata type.
 */
type BaseMetadata = Record<string, unknown>;

/**
 * Metadata rule type.
 *
 * @template T Metadata type. Should extend {@link BaseMetadata}.
 */
export interface MetadataRule<T extends BaseMetadata> extends DeclarativeRule {
    /**
     * Metadata object.
     */
    [METADATA_KEY]: T;
}

/**
 * Creates a declarative rule with metadata.
 *
 * @param content - Metadata rule configuration.
 *
 * @returns Declarative rule object with metadata.
 */
export const createMetadataRule = <T extends BaseMetadata>(content: T): MetadataRule<T> => {
    return {
        id: METADATA_RULE_ID,
        action: {
            type: RuleActionType.BLOCK,
        },
        condition: {
            urlFilter: DUMMY_RULE_URL,
            resourceTypes: [ResourceType.XmlHttpRequest],
        },
        [METADATA_KEY]: content,
    };
};
