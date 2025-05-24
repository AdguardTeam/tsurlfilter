/**
 * @file Utility functions for working with network rule nodes
 */

import { isUndefined } from '../utils/type-guards.js';
import {
    type ModifierList,
    type NetworkRule,
    RuleCategory,
    NetworkRuleType,
} from '../nodes/index.js';
import { AdblockSyntax } from '../utils/adblockers.js';
import { clone } from '../utils/clone.js';

/**
 * Creates a network rule node
 *
 * @param pattern Rule pattern
 * @param modifiers Rule modifiers (optional, default: undefined)
 * @param exception Exception rule flag (optional, default: false)
 * @param syntax Adblock syntax (optional, default: Common)
 * @returns Network rule node
 */
export function createNetworkRuleNode(
    pattern: string,
    modifiers: ModifierList | undefined = undefined,
    exception = false,
    syntax: AdblockSyntax = AdblockSyntax.Common,
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
