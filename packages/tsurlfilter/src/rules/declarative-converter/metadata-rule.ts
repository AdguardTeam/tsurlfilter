/**
 * @file Utility functions for working with metadata rules.
 *
 * Metadata rules are special declarative rules that do not block anything in themselves (so-called dummy rules),
 * but contain additional information. This information is used by the extension to process other rules,
 * conversion maps, and source maps.
 */

import { type DeclarativeRule, type ResourceType, RuleActionType } from './declarative-rule';
import { type MetadataRuleContent } from './metadata-rule-content';

/**
 * Metadata rule ID. It always should be the first rule in the rule set.
 */
const METADATA_RULE_ID = 1;

/**
 * Metadata key in the rule object.
 */
const METADATA_KEY = 'metadata';

/**
 * Dummy rule URL. It should not match any request.
 */
const DUMMY_RULE_URL = 'dummy.rule.adguard.com';

/**
 * Declarative rule extended with metadata.
 */
interface DeclarativeRuleWithMetadata<T extends MetadataRuleContent = MetadataRuleContent> extends DeclarativeRule {
    /**
     * Metadata for the rule.
     */
    [METADATA_KEY]: T;
}

/**
 * Creates a dummy declarative rule with a given ID.
 *
 * This rule is just used as a placeholder for metadata rules and should not block any requests.
 * Static rules can contain additional properties that are just ignored when rules are being loaded.
 *
 * @param id Rule ID.
 *
 * @returns Dummy declarative rule.
 */
const createDummyRule = (id = 1): DeclarativeRule => ({
    id,
    action: {
        type: RuleActionType.BLOCK,
    },
    condition: {
        urlFilter: DUMMY_RULE_URL,
        // TODO: Remove type casting when ResourceTypes starts supporting CSP_REPORT
        resourceTypes: ['csp_report' as ResourceType],
    },
});

/**
 * Creates a declarative rule with metadata.
 *
 * @param content Metadata rule configuration.
 *
 * @returns Declarative rule with metadata.
 */
export const createMetadataRule = (content: MetadataRuleContent): DeclarativeRuleWithMetadata => {
    const dummyRule = createDummyRule(METADATA_RULE_ID);

    return Object.assign(dummyRule, {
        [METADATA_KEY]: content,
    });
};
