import { describe, expect, test } from 'vitest';

import type { FilterList, NetworkRule } from '../../src/nodes';
import { NetworkRuleType, NodeType, RuleCategory } from '../../src/nodes';
import { SYNTAX_ALL } from '../../src/utils/syntax-flags';
import { find, findAll, findLast } from '../../src/walker';
import type { AnyWalkNode } from '../../src/walker';

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

describe('find', () => {
    test('returns the first matching node', () => {
        const filterList = makeFilterList([
            makeNetworkRule('rule1'),
            makeNetworkRule('rule2'),
        ]);

        const result = find(filterList, (node) => node.type === NetworkRuleType.NetworkRule);
        expect(result).toBeDefined();
        expect((result as NetworkRule).pattern.value).toBe('rule1');
    });

    test('returns undefined when no match', () => {
        const filterList = makeFilterList([makeNetworkRule('rule1')]);
        const result = find(filterList, (node) => node.type === NodeType.EmptyRule);
        expect(result).toBeUndefined();
    });

    test('stops after first match (does not visit remaining nodes)', () => {
        const filterList = makeFilterList([
            makeNetworkRule('rule1'),
            makeNetworkRule('rule2'),
            makeNetworkRule('rule3'),
        ]);

        let visitCount = 0;
        find(filterList, (node) => {
            visitCount += 1;
            return node.type === NetworkRuleType.NetworkRule;
        });

        // FilterList(no match) → first NetworkRule(match) → stop
        expect(visitCount).toBe(2);
    });
});

describe('findLast', () => {
    test('returns the last matching node in document order', () => {
        const filterList = makeFilterList([
            makeNetworkRule('rule1'),
            makeNetworkRule('rule2'),
            makeNetworkRule('rule3'),
        ]);

        const result = findLast(filterList, (node) => node.type === NetworkRuleType.NetworkRule);
        expect(result).toBeDefined();
        expect((result as NetworkRule).pattern.value).toBe('rule3');
    });

    test('returns undefined when no match', () => {
        const filterList = makeFilterList([makeNetworkRule('rule1')]);
        const result = findLast(filterList, (node) => node.type === NodeType.EmptyRule);
        expect(result).toBeUndefined();
    });
});

describe('findAll', () => {
    test('returns all matching nodes in document order', () => {
        const filterList = makeFilterList([
            makeNetworkRule('rule1'),
            makeNetworkRule('rule2'),
            makeNetworkRule('rule3'),
        ]);

        const results = findAll(filterList, (node) => node.type === NetworkRuleType.NetworkRule) as NetworkRule[];
        expect(results).toHaveLength(3);
        expect(results[0].pattern.value).toBe('rule1');
        expect(results[1].pattern.value).toBe('rule2');
        expect(results[2].pattern.value).toBe('rule3');
    });

    test('returns empty array when no match', () => {
        const filterList = makeFilterList([makeNetworkRule('rule1')]);
        const results = findAll(filterList, (node) => node.type === NodeType.EmptyRule);
        expect(results).toEqual([]);
    });

    test('collects Value nodes across multiple rules', () => {
        const filterList = makeFilterList([
            makeNetworkRule('rule1'),
            makeNetworkRule('rule2'),
        ]);

        const results = findAll(
            filterList,
            (node) => node.type === NodeType.Value,
        ) as Array<AnyWalkNode & { value: string }>;
        expect(results).toHaveLength(2);
        expect(results[0].value).toBe('rule1');
        expect(results[1].value).toBe('rule2');
    });
});
