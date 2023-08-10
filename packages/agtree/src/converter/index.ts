/**
 * @file Adblock rule converter
 *
 * This file is the entry point for all rule converters
 * which automatically detects the rule type and calls
 * the corresponding "sub-converter".
 */

import cloneDeep from 'clone-deep';

import { type AnyRule, RuleCategory } from '../parser/common';
import { CommentRuleConverter } from './comment';
import { CosmeticRuleConverter } from './cosmetic';
import { NetworkRuleConverter } from './network';
import { RuleConversionError } from '../errors/rule-conversion-error';
import { RuleConverterBase } from './base-interfaces/rule-converter-base';

/**
 * Adblock filtering rule converter class
 *
 * @todo Implement `convertToUbo` and `convertToAbp`
 */
export class RuleConverter extends RuleConverterBase {
    /**
     * Converts an adblock filtering rule to AdGuard format, if possible.
     *
     * @param rule Rule node to convert
     * @returns Array of converted rule nodes
     * @throws If the rule is invalid or cannot be converted
     */
    public static convertToAdg(rule: AnyRule): AnyRule[] {
        // Clone the provided AST node to avoid side effects
        const ruleNode = cloneDeep(rule);

        // Delegate conversion to the corresponding sub-converter
        // based on the rule category
        switch (ruleNode.category) {
            case RuleCategory.Comment:
                return CommentRuleConverter.convertToAdg(ruleNode);

            case RuleCategory.Cosmetic:
                return CosmeticRuleConverter.convertToAdg(ruleNode);

            case RuleCategory.Network:
                return NetworkRuleConverter.convertToAdg(ruleNode);

            default:
                throw new RuleConversionError(`Unknown rule category: ${ruleNode.category}`);
        }
    }
}
