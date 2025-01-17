import type { NetworkRule } from '../../nodes';
import { EMPTY, NETWORK_RULE_EXCEPTION_MARKER, NETWORK_RULE_SEPARATOR } from '../../utils/constants';
import { BaseGenerator } from '../base-generator';
import { ModifierListGenerator } from '../misc/modifier-list-generator';

/**
 * Generator for network rule nodes.
 */
export class NetworkRuleGenerator extends BaseGenerator {
    /**
     * Generates a string from a network rule AST node.
     *
     * @param node Network rule node to generate a string from.
     * @returns Generated string representation of the network rule.
     */
    public static generate(node: NetworkRule): string {
        let result = EMPTY;

        // If the rule is an exception, add the exception marker: `@@||example.org`
        if (node.exception) {
            result += NETWORK_RULE_EXCEPTION_MARKER;
        }

        // Add the pattern: `||example.org`
        result += node.pattern.value;

        // If there are modifiers, add a separator and the modifiers: `||example.org$important`
        if (node.modifiers && node.modifiers.children.length > 0) {
            result += NETWORK_RULE_SEPARATOR;
            result += ModifierListGenerator.generate(node.modifiers);
        }

        return result;
    }
}
