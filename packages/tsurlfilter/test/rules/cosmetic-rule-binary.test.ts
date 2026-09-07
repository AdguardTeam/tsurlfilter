import { describe, expect, it } from 'vitest';

import { CosmeticRuleDataReader, RuleParserPipeline } from '@adguard/agtree';

import { CosmeticRule } from '../../src/rules/cosmetic-rule';

const pipeline = new RuleParserPipeline();

/**
 * Builds a cosmetic rule via the structural (binary) path.
 *
 * @param rule Rule text to parse.
 *
 * @returns CosmeticRule materialized from the structural reader.
 */
function binary(rule: string): CosmeticRule {
    const { ctx } = pipeline.parseStructural(rule);
    const reader = new CosmeticRuleDataReader(ctx, 0);
    return CosmeticRule.createFromReader(reader, rule, 0);
}

describe('CosmeticRule binary path parity', () => {
    const rules = [
        // Element hiding (all four separators + whitespace variations).
        '##.banner',
        'example.org,~sub.example.org##banner',
        'example.com#@#.ad',
        'example.com#?#.banner:-abp-has(.ad)',
        'example.com##  .ad  ',
        // ADG scriptlets: canonical, double-quoted, and whitespace-normalized.
        "#%#//scriptlet('abp-abort-current-inline-script', 'a')",
        '#%#//scriptlet("set-constant", "a", "true")',
        "#%#//scriptlet( 'set-constant' , 'a' , 'true' )",
    ];

    it.each(rules)('matches AST construction for %s', (rule) => {
        const ast = new CosmeticRule(rule, 0);
        const bin = binary(rule);
        expect(bin.getType()).toBe(ast.getType());
        expect(bin.isAllowlist()).toBe(ast.isAllowlist());
        expect(bin.getContent()).toBe(ast.getContent());
        expect(bin.getPermittedDomains()).toEqual(ast.getPermittedDomains());
        expect(bin.getRestrictedDomains()).toEqual(ast.getRestrictedDomains());
        expect(bin.isExtendedCss()).toBe(ast.isExtendedCss());
    });
});
