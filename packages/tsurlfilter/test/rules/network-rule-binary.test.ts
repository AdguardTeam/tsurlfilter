import { describe, expect, it } from 'vitest';

import { NetworkRuleDataReader, RuleParserPipeline } from '@adguard/agtree';

import { NetworkRule } from '../../src/rules/network-rule';

const pipeline = new RuleParserPipeline();

/**
 * Builds a network rule via the structural (binary) path.
 *
 * @param rule Rule text to parse.
 *
 * @returns NetworkRule materialized from the structural reader.
 */
function binary(rule: string): NetworkRule {
    const { ctx } = pipeline.parseStructural(rule);
    const reader = new NetworkRuleDataReader(ctx, 0);
    return NetworkRule.createFromReader(reader, rule, 0);
}

describe('NetworkRule binary path parity', () => {
    const rules = [
        '||example.org^',
        '@@||example.org^',
        '/ads?\\./',
        '||a.com^$third-party,domain=x.com|~y.com',
        '||a.com^$~script,important',
    ];

    it.each(rules)('matches AST construction for %s', (rule) => {
        const ast = new NetworkRule(rule, 0);
        const bin = binary(rule);
        expect(bin.isAllowlist()).toBe(ast.isAllowlist());
        expect(bin.getPattern()).toBe(ast.getPattern());
        expect(bin.isRegexRule()).toBe(ast.isRegexRule());
        expect(bin.getPermittedDomains()).toEqual(ast.getPermittedDomains());
        expect(bin.getRestrictedDomains()).toEqual(ast.getRestrictedDomains());
        expect(bin.getPriorityWeight()).toBe(ast.getPriorityWeight());
    });

    it('throws too-general with ruleText', () => {
        const { ctx } = pipeline.parseStructural('ad');
        const reader = new NetworkRuleDataReader(ctx, 0);
        expect(() => NetworkRule.createFromReader(reader, 'ad', 0)).toThrow(/too general: ad/);
    });
});
