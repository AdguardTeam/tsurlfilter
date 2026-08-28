import { describe, expect, test } from 'vitest';

import type { CommentRule, FilterList, NetworkRule } from '../../src/nodes';
import {
    CommentRuleType,
    NetworkRuleType,
    NodeType,
    RuleCategory,
} from '../../src/nodes';
import { SYNTAX_ALL } from '../../src/utils/syntax-flags';
import { walk } from '../../src/walker';
import type { AnyWalkNode } from '../../src/walker';

/**
 * Helper: creates a minimal NetworkRule AST node.
 *
 * @param pattern Pattern string for the rule.
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
 * Helper: creates a minimal CommentRule AST node.
 *
 * @param text Comment text.
 *
 * @returns CommentRule AST node.
 */
function makeCommentRule(text: string): CommentRule {
    return {
        type: CommentRuleType.CommentRule,
        category: RuleCategory.Comment,
        syntax: SYNTAX_ALL,
        marker: { type: NodeType.Value, value: '!' },
        text: { type: NodeType.Value, value: text },
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

describe('walk', () => {
    test('visits all nodes in a FilterList with enter', () => {
        const filterList = makeFilterList([
            makeNetworkRule('||example.com^'),
            makeCommentRule('test comment'),
        ]);

        const visited: string[] = [];
        walk(filterList, {
            enter(node) {
                visited.push(node.type);
            },
        });

        // FilterList → NetworkRule → Value(pattern) → CommentRule → Value(marker) → Value(text)
        expect(visited).toEqual([
            NodeType.FilterList,
            NetworkRuleType.NetworkRule,
            NodeType.Value,
            CommentRuleType.CommentRule,
            NodeType.Value,
            NodeType.Value,
        ]);
    });

    test('calls leave after children are visited', () => {
        const filterList = makeFilterList([makeNetworkRule('||example.com^')]);

        const events: string[] = [];
        walk(filterList, {
            enter(node) {
                events.push(`enter:${node.type}`);
            },
            leave(node) {
                events.push(`leave:${node.type}`);
            },
        });

        expect(events).toEqual([
            `enter:${NodeType.FilterList}`,
            `enter:${NetworkRuleType.NetworkRule}`,
            `enter:${NodeType.Value}`,
            `leave:${NodeType.Value}`,
            `leave:${NetworkRuleType.NetworkRule}`,
            `leave:${NodeType.FilterList}`,
        ]);
    });

    test('works when called on a leaf node', () => {
        const leaf: AnyWalkNode = { type: NodeType.Value, value: 'test' };
        const visited: string[] = [];

        walk(leaf, {
            enter(node) {
                visited.push(node.type);
            },
        });

        expect(visited).toEqual([NodeType.Value]);
    });

    test('provides parent as null for root node', () => {
        const leaf: AnyWalkNode = { type: NodeType.Value, value: 'test' };
        let receivedParent: AnyWalkNode | null | undefined;

        walk(leaf, {
            enter(_node, parent) {
                receivedParent = parent;
            },
        });

        expect(receivedParent).toBeNull();
    });

    test('provides correct parent for child nodes', () => {
        const filterList = makeFilterList([makeNetworkRule('||example.com^')]);
        const parents: Array<string | null> = [];

        walk(filterList, {
            enter(_node, parent) {
                parents.push(parent?.type ?? null);
            },
        });

        // FilterList(parent=null) → NetworkRule(parent=FilterList) → Value(parent=NetworkRule)
        expect(parents).toEqual([null, NodeType.FilterList, NetworkRuleType.NetworkRule]);
    });
});
