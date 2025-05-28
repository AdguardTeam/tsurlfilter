import { describe, test, expect } from 'vitest';
import {
    tokenize,
    RuleType,
    CosmeticRuleType,
    decodeOffset,
    decodeLength,
    decodeType,
    decodeIsAllowlist,
} from '../../src/filterlist/tokenize';

const validateCosmetic = (
    rule: string,
    expected: {
        offset: number,
        length: number,
        type: CosmeticRuleType,
        allow: boolean,
        pattern: string,
        content: string,
        domains: string[],
    },
) => {
    const result = tokenize(rule)!;
    const sep = result.cosmeticSeparator!;
    expect(result.type).toBe(RuleType.Cosmetic);
    expect(decodeOffset(sep)).toBe(expected.offset);
    expect(decodeLength(sep)).toBe(expected.length);
    expect(decodeType(sep)).toBe(expected.type);
    expect(decodeIsAllowlist(sep)).toBe(expected.allow);
    expect(result.pattern).toBe(expected.pattern);
    expect(result.cosmeticContent).toBe(expected.content);
    expect(result.domains).toEqual(expected.domains);
};

describe('tokenize - full coverage', () => {
    test('ignores empty, short, and comment rules', () => {
        expect(tokenize('')).toBeNull();
        expect(tokenize('a')).toBeNull();
        expect(tokenize('!comment')).toBeNull();
        expect(tokenize('#hosts-like')).toBeNull();
    });

    test('parses cosmetic ## rule', () => {
        validateCosmetic(
            'example.com##.ad',
            {
                offset: 11,
                length: 2,
                type: CosmeticRuleType.ElementHidingRule,
                allow: false,
                pattern: 'example.com',
                content: '.ad',
                domains: ['example.com'],
            },
        );
    });

    test('parses cosmetic #? rule', () => {
        validateCosmetic(
            'example.com#?#div.banner',
            {
                offset: 11,
                length: 3,
                type: CosmeticRuleType.CssInjectionRule,
                allow: false,
                pattern: 'example.com',
                content: 'div.banner',
                domains: ['example.com'],
            },
        );
    });

    test('parses cosmetic #% rule', () => {
        validateCosmetic(
            'example.com#%#alert("ads")',
            {
                offset: 11,
                length: 3,
                type: CosmeticRuleType.JsInjectionRule,
                allow: false,
                pattern: 'example.com',
                content: 'alert("ads")',
                domains: ['example.com'],
            },
        );
    });

    test('parses cosmetic #$# rule', () => {
        validateCosmetic(
            'example.com#$#style',
            {
                offset: 11,
                length: 3,
                type: CosmeticRuleType.CssInjectionRule,
                allow: false,
                pattern: 'example.com',
                content: 'style',
                domains: ['example.com'],
            },
        );
    });

    test('parses cosmetic #$?# rule', () => {
        validateCosmetic(
            'example.com#$?#style',
            {
                offset: 11,
                length: 4,
                type: CosmeticRuleType.CssInjectionRule,
                allow: false,
                pattern: 'example.com',
                content: 'style',
                domains: ['example.com'],
            },
        );
    });

    test('parses allowlist #@# rule', () => {
        validateCosmetic(
            'example.com#@#.ad',
            {
                offset: 11,
                length: 3,
                type: CosmeticRuleType.ElementHidingRule,
                allow: true,
                pattern: 'example.com',
                content: '.ad',
                domains: ['example.com'],
            },
        );
    });

    test('parses allowlist #@?# rule', () => {
        validateCosmetic(
            'example.com#@?#div',
            {
                offset: 11,
                length: 4,
                type: CosmeticRuleType.ElementHidingRule,
                allow: true,
                pattern: 'example.com',
                content: 'div',
                domains: ['example.com'],
            },
        );
    });

    test('parses allowlist #@%# rule', () => {
        validateCosmetic(
            'example.com#@%#js()',
            {
                offset: 11,
                length: 4,
                type: CosmeticRuleType.JsInjectionRule,
                allow: true,
                pattern: 'example.com',
                content: 'js()',
                domains: ['example.com'],
            },
        );
    });

    test('parses allowlist #@$# rule', () => {
        validateCosmetic(
            'example.com#@$#css',
            {
                offset: 11,
                length: 4,
                type: CosmeticRuleType.CssInjectionRule,
                allow: true,
                pattern: 'example.com',
                content: 'css',
                domains: ['example.com'],
            },
        );
    });

    test('parses allowlist #@$?# rule', () => {
        validateCosmetic(
            'example.com#@$?#css',
            {
                offset: 11,
                length: 5,
                type: CosmeticRuleType.CssInjectionRule,
                allow: true,
                pattern: 'example.com',
                content: 'css',
                domains: ['example.com'],
            },
        );
    });

    test('parses cosmetic html filtering rule ($$)', () => {
        validateCosmetic(
            'example.com$$div',
            {
                offset: 11,
                length: 2,
                type: CosmeticRuleType.HtmlFilteringRule,
                allow: false,
                pattern: 'example.com',
                content: 'div',
                domains: ['example.com'],
            },
        );
    });

    test('parses cosmetic html filtering allowlist ($@$)', () => {
        validateCosmetic(
            'example.com$@$div',
            {
                offset: 11,
                length: 3,
                type: CosmeticRuleType.HtmlFilteringRule,
                allow: true,
                pattern: 'example.com',
                content: 'div',
                domains: ['example.com'],
            },
        );
    });

    test('parses cosmetic html filtering allowlist ($@$)', () => {
        validateCosmetic(
            '$@$div',
            {
                offset: 0,
                length: 3,
                type: CosmeticRuleType.HtmlFilteringRule,
                allow: true,
                pattern: '',
                content: 'div',
                domains: [],
            },
        );
    });

    test('parses network rule with domain modifier', () => {
        const result = tokenize('||ads.com^$domain=foo.com|bar.com')!;
        expect(result.type).toBe(RuleType.Network);
        expect(result.pattern).toBe('||ads.com^');
        expect(result.domains).toEqual(['foo.com', 'bar.com']);
    });

    test('parses network rule without domain modifier', () => {
        const result = tokenize('||ads.com^$third-party')!;
        expect(result.type).toBe(RuleType.Network);
        expect(result.pattern).toBe('||ads.com^');
        expect(result.domains).toEqual([]);
    });

    test('parses fallback network rule (no separator)', () => {
        const result = tokenize('||ads.com^')!;
        expect(result.type).toBe(RuleType.Network);
        expect(result.pattern).toBe('||ads.com^');
        expect(result.domains).toBeUndefined();
    });

    test('handles regex rule with $/ and skips improper separator', () => {
        const result = tokenize('/regex/$domain=ads.com')!;
        expect(result.type).toBe(RuleType.Network);
        expect(result.pattern).toBe('/regex/');
    });
});
