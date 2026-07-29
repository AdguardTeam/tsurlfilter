import { describe, expect, test } from 'vitest';

import {
    type CosmeticRuleParts,
    CosmeticRuleType,
    getRuleParts,
    type HostRuleParts,
    type NetworkRuleParts,
    RuleCategory,
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

    test('parses cosmetic rule with modifiers 2', () => {
        const rule = '[$path=/AdguardTeam]github.com##body';
        const parts = getRuleParts(rule) as CosmeticRuleParts;

        expect(parts).not.toBeNull();
        expect(parts!.category).toBe(RuleCategory.Cosmetic);
        expect(parts!.allowlist).toBeFalsy();
        expect(parts!.type).toBe(CosmeticRuleType.ElementHidingRule);
        expect(rule.slice(parts!.contentStart, parts!.contentEnd)).toBe('body');
        expect(rule.slice(parts!.separatorStart, parts!.separatorEnd)).toBe('##');
        expect(rule.slice(parts!.domainsStart, parts!.domainsEnd)).toBe('github.com');
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

    test('parses $replace with $ anchor and trailing value', () => {
        // The $ inside the regex /foo$/ must not be mistaken for the separator.
        const rule = '||example.org^$replace=/foo$/bar/';
        const parts = getRuleParts(rule) as NetworkRuleParts;

        expect(parts).not.toBeNull();
        expect(parts!.category).toBe(RuleCategory.Network);
        expect(rule.slice(parts!.patternStart, parts!.patternEnd)).toBe('||example.org^');
        expect(rule.slice(parts!.modifiersStart, parts!.modifiersEnd)).toBe('replace=/foo$/bar/');
    });

    test('parses $replace with $ anchor and empty replacement', () => {
        // The $ inside the regex /foo$/ must not be mistaken for the separator
        // even when the replacement is empty (strip-suffix rule).
        const rule = '||example.org^$replace=/foo$//';
        const parts = getRuleParts(rule) as NetworkRuleParts;

        expect(parts).not.toBeNull();
        expect(parts!.category).toBe(RuleCategory.Network);
        expect(rule.slice(parts!.patternStart, parts!.patternEnd)).toBe('||example.org^');
        expect(rule.slice(parts!.modifiersStart, parts!.modifiersEnd)).toBe('replace=/foo$//');
    });

    test('parses $removeparam with $ in the middle of a regex', () => {
        // The $ inside /x$y/ must not be mistaken for the separator.
        const rule = '||example.com$removeparam=/x$y/';
        const parts = getRuleParts(rule) as NetworkRuleParts;

        expect(parts).not.toBeNull();
        expect(parts!.category).toBe(RuleCategory.Network);
        expect(rule.slice(parts!.patternStart, parts!.patternEnd)).toBe('||example.com');
        expect(rule.slice(parts!.modifiersStart, parts!.modifiersEnd)).toBe('removeparam=/x$y/');
    });

    test('parses $removeparam with escaped $ inside a regex', () => {
        // The escaped \$ inside the regex must not be mistaken for the separator.
        const rule = '||example.com$removeparam=/x\\$y/';
        const parts = getRuleParts(rule) as NetworkRuleParts;

        expect(parts).not.toBeNull();
        expect(parts!.category).toBe(RuleCategory.Network);
        expect(rule.slice(parts!.patternStart, parts!.patternEnd)).toBe('||example.com');
        expect(rule.slice(parts!.modifiersStart, parts!.modifiersEnd)).toBe('removeparam=/x\\$y/');
    });

    test('parses $replace with $ in the middle of a regex', () => {
        // The $ inside /a$b/ in the pattern part must not be mistaken for the separator.
        const rule = '||example.org^$replace=/a$b/good/';
        const parts = getRuleParts(rule) as NetworkRuleParts;

        expect(parts).not.toBeNull();
        expect(parts!.category).toBe(RuleCategory.Network);
        expect(rule.slice(parts!.patternStart, parts!.patternEnd)).toBe('||example.org^');
        expect(rule.slice(parts!.modifiersStart, parts!.modifiersEnd)).toBe('replace=/a$b/good/');
    });

    test('parses $replace with capture group reference in replacement', () => {
        // The $ in $1 (capture group reference in the replacement string)
        // must not be mistaken for the separator.
        const rule = '||example.com^$replace=/(a)/$1/';
        const parts = getRuleParts(rule) as NetworkRuleParts;

        expect(parts).not.toBeNull();
        expect(parts!.category).toBe(RuleCategory.Network);
        expect(rule.slice(parts!.patternStart, parts!.patternEnd)).toBe('||example.com^');
        expect(rule.slice(parts!.modifiersStart, parts!.modifiersEnd)).toBe('replace=/(a)/$1/');
    });

    test('parses $replace with $ anchor, capture group, and flags', () => {
        // Combination: $ anchor in pattern, $1 in replacement, and g flag.
        const rule = '||example.org^$replace=/(a)$/$1/g';
        const parts = getRuleParts(rule) as NetworkRuleParts;

        expect(parts).not.toBeNull();
        expect(parts!.category).toBe(RuleCategory.Network);
        expect(rule.slice(parts!.patternStart, parts!.patternEnd)).toBe('||example.org^');
        expect(rule.slice(parts!.modifiersStart, parts!.modifiersEnd)).toBe('replace=/(a)$/$1/g');
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
