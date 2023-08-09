/**
 * @file Network rule converter
 */

import cloneDeep from 'clone-deep';
import { NetworkRule } from '../../parser/common';
import { NetworkRuleModifierListConverter } from '../misc/network-rule-modifier';
import { RuleConverterBase } from '../base-interfaces/rule-converter-base';

/**
 * Network rule converter (also known as "basic rule converter")
 *
 * @todo Implement `convertToUbo` and `convertToAbp`
 */
export class NetworkRuleConverter extends RuleConverterBase {
    /**
     * Convert a network rule to AdGuard format
     *
     * @param rule Rule to convert, can be a string or an AST
     * @returns Array of converted rules ASTs
     * @throws If the rule is invalid or incompatible
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
