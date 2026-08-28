import { describe, expect, test } from 'vitest';

import type { FilterList, NetworkRule } from '../../src/nodes';
import { NetworkRuleType, NodeType, RuleCategory } from '../../src/nodes';
import { SYNTAX_ALL } from '../../src/utils/syntax-flags';
import { walk, WalkAction } from '../../src/walker';

/**
 * Helper: creates a minimal NetworkRule AST node.
 *
 * @param pattern Pattern string.
 *
 * @returns NetworkRule AST node.
 */
function makeNetworkRule(pattern: string): NetworkRule {
    return {
        type: NetworkRuleType.NetworkRule,
        category: RuleCategory.Network,
        syntax: SYNTAX_ALL,
        exception: false,
        pattern: { type: NodeType.Value, value: pattern },
    };
}

/**
 * Helper: creates a FilterList with rules.
 *
 * @param children Array of rules.
 *
 * @returns FilterList AST node.
 */
function makeFilterList(children: FilterList['children']): FilterList {
    return {
        type: NodeType.FilterList,
        children,
    };
}

describe('walk — control flow', () => {
    describe('stop', () => {
        test('enter returning Stop terminates traversal immediately', () => {
            const filterList = makeFilterList([
                makeNetworkRule('rule1'),
                makeNetworkRule('rule2'),
                makeNetworkRule('rule3'),
            ]);

            const visited: string[] = [];
            walk(filterList, {
                enter(node) {
                    visited.push(`enter:${node.type}`);
                    if ('value' in node && node.value === 'rule1') {
                        return WalkAction.Stop;
                    }
                    return undefined;
                },
                leave(node) {
                    visited.push(`leave:${node.type}`);
                },
            });

            // Should visit: FilterList(enter), NetworkRule(enter), Value(enter=stop)
            // No leave calls after stop
            expect(visited).toEqual([
                `enter:${NodeType.FilterList}`,
                `enter:${NetworkRuleType.NetworkRule}`,
                `enter:${NodeType.Value}`,
            ]);
        });

        test('leave returning Stop terminates traversal', () => {
            const filterList = makeFilterList([
                makeNetworkRule('rule1'),
                makeNetworkRule('rule2'),
            ]);

            const visited: string[] = [];
            walk(filterList, {
                enter(node) {
                    visited.push(`enter:${node.type}`);
                },
                leave(node) {
                    visited.push(`leave:${node.type}`);
                    if (node.type === NetworkRuleType.NetworkRule) {
                        return WalkAction.Stop;
                    }
                    return undefined;
                },
            });

            // Visit first NetworkRule fully, then stop on its leave
            expect(visited).toEqual([
                `enter:${NodeType.FilterList}`,
                `enter:${NetworkRuleType.NetworkRule}`,
                `enter:${NodeType.Value}`,
                `leave:${NodeType.Value}`,
                `leave:${NetworkRuleType.NetworkRule}`,
            ]);
        });
    });

    describe('skip', () => {
        test('enter returning Skip prevents visiting children', () => {
            const filterList = makeFilterList([
                makeNetworkRule('rule1'),
                makeNetworkRule('rule2'),
            ]);

            const visited: string[] = [];
            walk(filterList, {
                enter(node) {
                    visited.push(`enter:${node.type}`);
                    if (node.type === NetworkRuleType.NetworkRule) {
                        return WalkAction.Skip;
                    }
                    return undefined;
                },
                leave(node) {
                    visited.push(`leave:${node.type}`);
                },
            });

            // Skip children of both NetworkRules, but leave is still called
            expect(visited).toEqual([
                `enter:${NodeType.FilterList}`,
                `enter:${NetworkRuleType.NetworkRule}`,
                `leave:${NetworkRuleType.NetworkRule}`,
                `enter:${NetworkRuleType.NetworkRule}`,
                `leave:${NetworkRuleType.NetworkRule}`,
                `leave:${NodeType.FilterList}`,
            ]);
        });

        test('skip does not affect sibling nodes', () => {
            const filterList = makeFilterList([
                makeNetworkRule('rule1'),
                makeNetworkRule('rule2'),
            ]);

            let skipCount = 0;
            const visited: string[] = [];
            walk(filterList, {
                enter(node) {
                    visited.push(node.type);
                    // Skip only the first NetworkRule
                    if (node.type === NetworkRuleType.NetworkRule) {
                        skipCount += 1;
                        if (skipCount === 1) {
                            return WalkAction.Skip;
                        }
                    }
                    return undefined;
                },
            });

            // FilterList, NetworkRule(skip), NetworkRule, Value(pattern of rule2)
            expect(visited).toEqual([
                NodeType.FilterList,
                NetworkRuleType.NetworkRule,
                NetworkRuleType.NetworkRule,
                NodeType.Value,
            ]);
        });
    });
});
