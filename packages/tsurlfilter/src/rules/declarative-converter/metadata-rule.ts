/**
 * @file Utility functions for working with metadata rules.
 *
 * Metadata rules are special declarative rules that do not block anything in themselves (so-called dummy rules),
 * but contain additional information. This information is used by the extension to process other rules,
 * conversion maps, and source maps.
 */

import { z } from 'zod';

import {
    type DeclarativeRule,
    DeclarativeRuleValidator,
    ResourceType,
    RuleActionType,
} from './declarative-rule';
import { metadataRuleContentValidator, type MetadataRuleContent } from './metadata-rule-content';

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

export const metadataRuleValidator = DeclarativeRuleValidator.extend({
    id: z.literal(METADATA_RULE_ID),
    [METADATA_KEY]: metadataRuleContentValidator,
});

/**
 * Declarative rule extended with metadata.
 */
export type DeclarativeRuleWithMetadata = z.infer<typeof metadataRuleValidator>;

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
export const createDummyRule = (id = 1): DeclarativeRule => ({
    id,
    action: {
        type: RuleActionType.BLOCK,
    },
    condition: {
        urlFilter: DUMMY_RULE_URL,
        resourceTypes: [ResourceType.XmlHttpRequest],
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
    }) as DeclarativeRuleWithMetadata;
};
