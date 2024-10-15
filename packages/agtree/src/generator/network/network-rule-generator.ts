import type { NetworkRule } from '../../nodes';
import { EMPTY, NETWORK_RULE_EXCEPTION_MARKER, NETWORK_RULE_SEPARATOR } from '../../utils/constants';
import { BaseGenerator } from '../base-generator';
import { ModifierListGenerator } from '../misc/modifier-list-generator';

export class NetworkRuleGenerator extends BaseGenerator {
    /**
     * Converts a network rule (basic rule) AST to a string.
     *
     * @param node Network rule node
     * @returns Raw string
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
