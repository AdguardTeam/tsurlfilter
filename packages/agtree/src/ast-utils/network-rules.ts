/**
 * @file Utility functions for working with network rule nodes.
 */

import {
    type ModifierList,
    type NetworkRule,
    NetworkRuleType,
    RuleCategory,
} from '../nodes';
import { clone } from '../utils/clone';
import { SYNTAX_UNKNOWN, type SyntaxFlags } from '../utils/syntax-flags';
import { isUndefined } from '../utils/type-guards';

/**
 * Creates a network rule node.
 *
 * @param pattern Rule pattern.
 * @param modifiers Rule modifiers (optional, default: undefined).
 * @param exception Exception rule flag (optional, default: false).
 * @param syntax Adblock syntax flags (optional, default: {@link SYNTAX_UNKNOWN}).
 *
 * @returns Network rule node.
 */
export function createNetworkRuleNode(
    pattern: string,
    modifiers: ModifierList | undefined = undefined,
    exception = false,
    syntax: SyntaxFlags = SYNTAX_UNKNOWN,
): NetworkRule {
    const result: NetworkRule = {
        category: RuleCategory.Network,
        type: NetworkRuleType.NetworkRule,
        syntax,
        exception,
        pattern: {
            type: 'Value',
            value: pattern,
        },
    };

    if (!isUndefined(modifiers)) {
        result.modifiers = clone(modifiers);
    }

    return result;
}
