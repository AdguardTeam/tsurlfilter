/**
 * @file Network rule converter
 */

import cloneDeep from 'clone-deep';

import { type NetworkRule } from '../../parser/common';
import { NetworkRuleModifierListConverter } from '../misc/network-rule-modifier';
import { RuleConverterBase } from '../base-interfaces/rule-converter-base';

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
     * @returns Array of converted rule nodes
     * @throws If the rule is invalid or cannot be converted
     */
    public static convertToAdg(rule: NetworkRule): NetworkRule[] {
        // Clone the provided AST node to avoid side effects
        const ruleNode = cloneDeep(rule);

        // Convert modifiers
        if (ruleNode.modifiers) {
            Object.assign(ruleNode.modifiers, NetworkRuleModifierListConverter.convertToAdg(ruleNode.modifiers));
        }

        return [ruleNode];
    }
}
