import { describe, test, expect } from 'vitest';
import {
    getRuleParts,
    RuleCategory,
    CosmeticRuleType,
    type CosmeticRuleParts,
    type NetworkRuleParts,
    type HostRuleParts,
} from '../../src/filterlist/rule-parts';

describe('getRuleParts', () => {
    test('ignores empty, short, and comment rules', () => {
        expect(getRuleParts('')).toBeNull();
        expect(getRuleParts('a')).toBeNull();
        expect(getRuleParts('! adblock-like comment')).toBeNull();
        expect(getRuleParts('# hosts-like comment')).toBeNull();
    });

    test('parses simple cosmetic rule', () => {
        const rule = 'example.com##.ad';
        const parts = getRuleParts(rule) as CosmeticRuleParts;

        expect(parts).not.toBeNull();
        expect(parts!.category).toBe(RuleCategory.Cosmetic);
        expect(parts!.allowlist).toBeFalsy();
        expect(parts!.type).toBe(CosmeticRuleType.ElementHidingRule);
        expect(rule.slice(parts!.contentStart, parts!.contentEnd)).toBe('.ad');
        expect(rule.slice(parts!.separatorStart, parts!.separatorEnd)).toBe('##');
        expect(rule.slice(parts!.domainsStart, parts!.domainsEnd)).toBe('example.com');
    });

    test('parses allowlist cosmetic rule', () => {
        const rule = 'example.com#@#.ad';
        const parts = getRuleParts(rule) as CosmeticRuleParts;

        expect(parts).not.toBeNull();
        expect(parts!.category).toBe(RuleCategory.Cosmetic);
        expect(parts!.allowlist).toBeTruthy();
        expect(parts!.type).toBe(CosmeticRuleType.ElementHidingRule);
        expect(rule.slice(parts!.contentStart, parts!.contentEnd)).toBe('.ad');
        expect(rule.slice(parts!.separatorStart, parts!.separatorEnd)).toBe('#@#');
        expect(rule.slice(parts!.domainsStart, parts!.domainsEnd)).toBe('example.com');
    });

    test('parses cosmetic rule with modifiers', () => {
        const rule = '[$domain=example.com]##.ad';
        const parts = getRuleParts(rule) as CosmeticRuleParts;

        expect(parts).not.toBeNull();
        expect(parts!.category).toBe(RuleCategory.Cosmetic);
        expect(parts!.allowlist).toBeFalsy();
        expect(parts!.type).toBe(CosmeticRuleType.ElementHidingRule);
        expect(rule.slice(parts!.contentStart, parts!.contentEnd)).toBe('.ad');
        expect(rule.slice(parts!.separatorStart, parts!.separatorEnd)).toBe('##');
        expect(rule.slice(parts!.domainsStart, parts!.domainsEnd)).toBe('example.com');
    });

    test('parses HTML cosmetic rule', () => {
        const rule = 'example.com$$.ad';
        const parts = getRuleParts(rule) as CosmeticRuleParts;

        expect(parts).not.toBeNull();
        expect(parts.category).toBe(RuleCategory.Cosmetic);
        expect(parts.allowlist).toBe(false);
        expect(parts.type).toBe(CosmeticRuleType.HtmlFilteringRule);
        expect(rule.slice(parts.separatorStart, parts.separatorEnd)).toBe('$$');
    });

    test('does not parse obviously invalid cosmetic rule', () => {
        const rule = '[domain=example.com]##.ad';
        const parts = getRuleParts(rule);

        expect(parts).toBeNull();
    });

    test('ignore cosmetic rules if `ignoreCosmetic` is set', () => {
        const rule = 'example.com##.ad$param';
        const parts = getRuleParts(rule, true);

        expect(parts).toBeNull();
    });

    test('parses basic network rule', () => {
        const rule = '||example.com^';
        const parts = getRuleParts(rule) as NetworkRuleParts;

        expect(parts).not.toBeNull();
        expect(parts!.category).toBe(RuleCategory.Network);
        expect(parts!.allowlist).toBeFalsy();
        expect(rule.slice(parts!.patternStart, parts!.patternEnd)).toBe('||example.com^');
    });

    test('parses allowlist network rule', () => {
        const rule = '@@||example.com^';
        const parts = getRuleParts(rule) as NetworkRuleParts;

        expect(parts).not.toBeNull();
        expect(parts!.category).toBe(RuleCategory.Network);
        expect(parts!.allowlist).toBeTruthy();
        expect(rule.slice(parts!.patternStart, parts!.patternEnd)).toBe('||example.com^');
    });

    test('parses network rule with modifiers', () => {
        const rule = '||example.com^$third-party';
        const parts = getRuleParts(rule) as NetworkRuleParts;

        expect(parts).not.toBeNull();
        expect(parts!.category).toBe(RuleCategory.Network);
        expect(parts!.allowlist).toBeFalsy();
        expect(rule.slice(parts!.patternStart, parts!.patternEnd)).toBe('||example.com^');
        expect(rule.slice(parts!.modifiersStart, parts!.modifiersEnd)).toBe('third-party');
    });

    test('parses network rule with domains', () => {
        const rule = '||example.com^$domain=example.net';
        const parts = getRuleParts(rule) as NetworkRuleParts;

        expect(parts).not.toBeNull();
        expect(parts!.category).toBe(RuleCategory.Network);
        expect(parts!.allowlist).toBeFalsy();
        expect(rule.slice(parts!.patternStart, parts!.patternEnd)).toBe('||example.com^');
        expect(rule.slice(parts!.modifiersStart, parts!.modifiersEnd)).toBe('domain=example.net');
        expect(rule.slice(parts!.domainsStart, parts!.domainsEnd)).toBe('example.net');
    });

    test('parses complex network rule', () => {
        const rule = '@@||example.com^$third-party,domain=example.net|example.org,script';
        const parts = getRuleParts(rule) as NetworkRuleParts;

        expect(parts).not.toBeNull();
        expect(parts!.category).toBe(RuleCategory.Network);
        expect(parts!.allowlist).toBeTruthy();
        expect(rule.slice(parts!.patternStart, parts!.patternEnd)).toBe('||example.com^');
        expect(rule.slice(parts!.modifiersStart, parts!.modifiersEnd)).toBe(
            'third-party,domain=example.net|example.org,script',
        );
        expect(rule.slice(parts!.domainsStart, parts!.domainsEnd)).toBe('example.net|example.org');
    });

    test('parses host rules if `ignoreHosts` is false', () => {
        const rule = '127.0.0.1 example.com alias # hosts-like comment';
        const parts = getRuleParts(rule, false, false) as HostRuleParts;

        expect(parts).not.toBeNull();
        expect(parts!.category).toBe(RuleCategory.Host);
        expect(rule.slice(parts!.domainsStart, parts!.domainsEnd)).toBe('example.com alias');
        expect(rule.slice(parts!.ipStart, parts!.ipEnd)).toBe('127.0.0.1');
    });
});
