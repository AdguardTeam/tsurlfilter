/**
 * @file Adblock rule converter
 *
 * This file is the entry point for all rule converters
 * which automatically detects the rule type and calls
 * the corresponding "sub-converter".
 */

import { type AnyRule, RuleCategory } from '../parser/common';
import { CommentRuleConverter } from './comment';
import { CosmeticRuleConverter } from './cosmetic';
import { NetworkRuleConverter } from './network';
import { RuleConversionError } from '../errors/rule-conversion-error';
import { RuleConverterBase } from './base-interfaces/rule-converter-base';
import { type NodeConversionResult } from './base-interfaces/conversion-result';

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
     * @returns An object which follows the {@link NodeConversionResult} interface. Its `result` property contains
     * the array of converted rule nodes, and its `isConverted` flag indicates whether the original rule was converted.
     * If the rule was not converted, the result array will contain the original node with the same object reference
     * @throws If the rule is invalid or cannot be converted
     */
    public static convertToAdg(rule: AnyRule): NodeConversionResult<AnyRule> {
        // Delegate conversion to the corresponding sub-converter
        // based on the rule category
        switch (rule.category) {
            case RuleCategory.Comment:
                return CommentRuleConverter.convertToAdg(rule);

            case RuleCategory.Cosmetic:
                return CosmeticRuleConverter.convertToAdg(rule);

            case RuleCategory.Network:
                return NetworkRuleConverter.convertToAdg(rule);

            default:
                throw new RuleConversionError(`Unknown rule category: ${rule.category}`);
        }
    }
}
