/**
 * @file Adblock rule converter
 *
 * This file is the entry point for all rule converters
 * which automatically detects the rule type and calls
 * the corresponding "sub-converter".
 */

import { type AnyRule, RuleCategory, NetworkRuleType } from '../nodes/index.js';
import { CommentRuleConverter } from './comment/index.js';
import { CosmeticRuleConverter } from './cosmetic/index.js';
import { NetworkRuleConverter } from './network/index.js';
import { RuleConversionError } from '../errors/rule-conversion-error.js';
import { RuleConverterBase } from './base-interfaces/rule-converter-base.js';
import { createConversionResult, type NodeConversionResult } from './base-interfaces/conversion-result.js';

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
                // TODO: Handle hosts rules later
                if (rule.type === NetworkRuleType.HostRule) {
                    return createConversionResult([rule], false);
                }
                return NetworkRuleConverter.convertToAdg(rule);

            case RuleCategory.Invalid:
            case RuleCategory.Empty:
                // Just forward the rule as is
                return createConversionResult([rule], false);

            default:
                // Never happens during normal operation
                throw new RuleConversionError('Unknown rule category');
        }
    }

    /**
     * Converts an adblock filtering rule to uBlock Origin format, if possible.
     *
     * @param rule Rule node to convert
     * @returns An object which follows the {@link NodeConversionResult} interface. Its `result` property contains
     * the array of converted rule nodes, and its `isConverted` flag indicates whether the original rule was converted.
     * If the rule was not converted, the result array will contain the original node with the same object reference
     * @throws If the rule is invalid or cannot be converted
     */
    // TODO: Add support for other rule types
    public static convertToUbo(rule: AnyRule): NodeConversionResult<AnyRule> {
        if (rule.category === RuleCategory.Cosmetic) {
            return CosmeticRuleConverter.convertToUbo(rule);
        }

        if (rule.category === RuleCategory.Network) {
            return NetworkRuleConverter.convertToUbo(rule);
        }

        return createConversionResult([rule], false);
    }
}
