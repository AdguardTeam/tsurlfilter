/**
 * @file Type-guard overloads for the walker find utilities (F-055, T-026).
 *
 * The assertions are type-level: `expectTypeOf` fails the build if a
 * type-guard predicate does not narrow the result.
 */

import {
    describe,
    expect,
    expectTypeOf,
    test,
} from 'vitest';

import { RuleParserPipeline } from '../../src/ast-builder/rule-parser';
import {
    type AnyRule,
    NetworkRuleType,
    NodeType,
    type RawRule,
} from '../../src/nodes';
import { combineSyntax, SYNTAX_ADG, SYNTAX_UBO } from '../../src/utils/syntax-flags';
import { find, findAll, findLast } from '../../src/walker';

const parser = new RuleParserPipeline();
const ast = parser.parse('||example.com^$third-party') as AnyRule;

/**
 * Type guard for the network rule node of a network rule.
 *
 * @param node Walker node.
 *
 * @returns True for the network rule node.
 */
const isNetworkRule = (node: Parameters<typeof find>[0]): node is RawRule => (
    (node as { type?: string }).type === NetworkRuleType.NetworkRule
);

describe('walker find utilities narrow with a type guard', () => {
    test('find returns the guarded type', () => {
        const found = find(ast, isNetworkRule);

        expect(found).toBeDefined();
        expectTypeOf(found).toEqualTypeOf<RawRule | undefined>();
    });

    test('findLast returns the guarded type', () => {
        const found = findLast(ast, isNetworkRule);

        expect(found).toBeDefined();
        expectTypeOf(found).toEqualTypeOf<RawRule | undefined>();
    });

    test('findAll returns an array of the guarded type', () => {
        const found = findAll(ast, isNetworkRule);

        expect(found.length).toBeGreaterThan(0);
        expectTypeOf(found).toEqualTypeOf<RawRule[]>();
    });

    test('a boolean predicate still returns the generic node type', () => {
        const found = find(ast, (node) => (node as { type?: string }).type === NodeType.Value);

        // No type guard, so no narrowing — the caller keeps the union.
        expectTypeOf(found).toEqualTypeOf<Parameters<typeof find>[0] | undefined>();
    });
});

describe('combineSyntax builds flags without a cast', () => {
    test('combines product bits', () => {
        const flags = combineSyntax(SYNTAX_ADG, SYNTAX_UBO);

        expectTypeOf(flags).toEqualTypeOf<ReturnType<typeof combineSyntax>>();
        expect(flags).toBe(SYNTAX_ADG | SYNTAX_UBO);
    });

    test('an empty call is the unknown value', () => {
        expect(combineSyntax()).toBe(0);
    });
});
