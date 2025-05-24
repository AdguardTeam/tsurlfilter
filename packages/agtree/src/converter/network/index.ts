/**
 * @file Network rule converter
 */

import {
    RuleCategory,
    type NetworkRule,
    NetworkRuleType,
    type AnyNetworkRule,
} from '../../nodes/index.js';
import { NetworkRuleModifierListConverter } from '../misc/network-rule-modifier.js';
import { RuleConverterBase } from '../base-interfaces/rule-converter-base.js';
import { createNodeConversionResult, type NodeConversionResult } from '../base-interfaces/conversion-result.js';

/**
 * Network rule converter class (also known as "basic rule converter")
 *
 * @todo Implement `convertToUbo` and `convertToAbp`
 */
export class NetworkRuleConverter extends RuleConverterBase {
    /**
     * Converts a network rule to AdGuard format, if possible.
     *
     * @param rule Rule node to convert
     * @returns An object which follows the {@link NodeConversionResult} interface. Its `result` property contains
     * the array of converted rule nodes, and its `isConverted` flag indicates whether the original rule was converted.
     * If the rule was not converted, the result array will contain the original node with the same object reference
     * @throws If the rule is invalid or cannot be converted
     */
    public static convertToAdg(rule: AnyNetworkRule): NodeConversionResult<NetworkRule> {
        // TODO: add support for host rules
        if (rule.type !== NetworkRuleType.NetworkRule) {
            throw new Error(`Invalid rule type: ${rule.type}`);
        }

        if (rule.modifiers) {
            const modifiers = NetworkRuleModifierListConverter.convertToAdg(rule.modifiers, rule.exception);

            // If the object reference is different, it means that the modifiers were converted
            // In this case, we should clone the entire rule and replace the modifiers with the converted ones
            if (modifiers.isConverted) {
                return {
                    result: [{
                        category: RuleCategory.Network,
                        type: NetworkRuleType.NetworkRule,
                        syntax: rule.syntax,
                        exception: rule.exception,
                        pattern: {
                            type: 'Value',
                            value: rule.pattern.value,
                        },
                        modifiers: modifiers.result,
                    }],
                    isConverted: true,
                };
            }
        }

        // If the modifiers were not converted, return the original rule
        return createNodeConversionResult([rule], false);
    }

    /**
     * Converts a network rule to uBlock format, if possible.
     *
     * @param rule Rule node to convert
     * @returns An object which follows the {@link NodeConversionResult} interface. Its `result` property contains
     * the array of converted rule nodes, and its `isConverted` flag indicates whether the original rule was converted.
     * If the rule was not converted, the result array will contain the original node with the same object reference
     * @throws If the rule is invalid or cannot be converted
     */
    public static convertToUbo(rule: AnyNetworkRule): NodeConversionResult<NetworkRule> {
        // TODO: add support for host rules
        if (rule.type !== NetworkRuleType.NetworkRule) {
            throw new Error(`Invalid rule type: ${rule.type}`);
        }

        if (rule.modifiers) {
            const modifiers = NetworkRuleModifierListConverter.convertToUbo(rule.modifiers, rule.exception);

            // If the object reference is different, it means that the modifiers were converted
            // In this case, we should clone the entire rule and replace the modifiers with the converted ones
            if (modifiers.isConverted) {
                return {
                    result: [{
                        category: RuleCategory.Network,
                        type: NetworkRuleType.NetworkRule,
                        syntax: rule.syntax,
                        exception: rule.exception,
                        pattern: {
                            type: 'Value',
                            value: rule.pattern.value,
                        },
                        modifiers: modifiers.result,
                    }],
                    isConverted: true,
                };
            }
        }

        // If the modifiers were not converted, return the original rule
        return createNodeConversionResult([rule], false);
    }
}
