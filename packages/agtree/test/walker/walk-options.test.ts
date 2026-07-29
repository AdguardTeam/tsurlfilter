import { describe, expect, test } from 'vitest';

import type { FilterList, NetworkRule } from '../../src/nodes';
import { NetworkRuleType, NodeType, RuleCategory } from '../../src/nodes';
import { SYNTAX_ALL } from '../../src/utils/syntax-flags';
import { walk } from '../../src/walker';

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

describe('walk — options', () => {
    describe('reverse', () => {
        test('visits children in reverse order', () => {
            const filterList = makeFilterList([
                makeNetworkRule('rule1'),
                makeNetworkRule('rule2'),
                makeNetworkRule('rule3'),
            ]);

            const patterns: string[] = [];
            walk(filterList, {
                reverse: true,
                enter(node) {
                    if (node.type === NodeType.Value && 'value' in node) {
                        patterns.push(node.value as string);
                    }
                },
            });

            // Reverse: rule3, rule2, rule1
            expect(patterns).toEqual(['rule3', 'rule2', 'rule1']);
        });
    });

    describe('filter', () => {
        test('single type filter — only matching nodes trigger callback', () => {
            const filterList = makeFilterList([
                makeNetworkRule('rule1'),
                makeNetworkRule('rule2'),
            ]);

            const visited: string[] = [];
            walk(filterList, {
                filter: new Set([NodeType.Value]),
                enter(node) {
                    visited.push(node.type);
                },
            });

            // Only Value nodes trigger the callback
            expect(visited).toEqual([NodeType.Value, NodeType.Value]);
        });

        test('multi-type filter — multiple types trigger callback', () => {
            const filterList = makeFilterList([
                makeNetworkRule('rule1'),
            ]);

            const visited: string[] = [];
            walk(filterList, {
                filter: new Set([NodeType.FilterList, NetworkRuleType.NetworkRule]),
                enter(node) {
                    visited.push(node.type);
                },
            });

            expect(visited).toEqual([NodeType.FilterList, NetworkRuleType.NetworkRule]);
        });

        test('filter does not prevent descending into children', () => {
            const filterList = makeFilterList([
                makeNetworkRule('rule1'),
            ]);

            const visited: string[] = [];
            walk(filterList, {
                filter: new Set([NodeType.Value]),
                enter(node) {
                    visited.push(node.type);
                },
            });

            // The tree is still fully traversed internally to reach Value nodes
            expect(visited).toEqual([NodeType.Value]);
        });
    });

    describe('context', () => {
        test('context object is passed to enter and leave', () => {
            const filterList = makeFilterList([
                makeNetworkRule('rule1'),
            ]);

            const ctx = { enterCount: 0, leaveCount: 0 };
            walk(filterList, {
                context: ctx,
                enter(_node, _parent, context) {
                    context.enterCount += 1;
                },
                leave(_node, _parent, context) {
                    context.leaveCount += 1;
                },
            });

            // FilterList + NetworkRule + Value = 3 nodes
            expect(ctx.enterCount).toBe(3);
            expect(ctx.leaveCount).toBe(3);
        });
    });
});
