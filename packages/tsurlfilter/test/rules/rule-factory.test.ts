import { describe, expect, it } from 'vitest';

import { CompatibilityTypes, setConfiguration } from '../../src/configuration';
import { CosmeticRule } from '../../src/rules/cosmetic-rule';
import { HostRule } from '../../src/rules/host-rule';
import { NetworkRule, NetworkRuleOption } from '../../src/rules/network-rule';
import { RULE_INDEX_NONE } from '../../src/rules/rule';
import { RuleFactory } from '../../src/rules/rule-factory';
import { createRule } from '../helpers/rule-creator';

describe('RuleFactory Builder Test', () => {
    it('works if builder creates correct rules', () => {
        let rule;

        rule = createRule('', 1);
        expect(rule).toBeFalsy();

        rule = createRule('! comment', 1);
        expect(rule).toBeFalsy();

        rule = createRule('#', 1);
        expect(rule).toBeFalsy();

        rule = createRule('##.banner', 1);
        expect(rule).toBeTruthy();
        expect(rule!.getIndex()).toBe(RULE_INDEX_NONE);
        expect(rule!.getFilterListId()).toBe(1);
        expect(rule!).toBeInstanceOf(CosmeticRule);

        rule = createRule('||example.org^', 1);
        expect(rule).toBeTruthy();
        expect(rule!.getIndex()).toBe(RULE_INDEX_NONE);
        expect(rule!.getFilterListId()).toBe(1);
        expect(rule!).toBeInstanceOf(NetworkRule);

        rule = createRule('127.0.0.1 localhost', 1, RULE_INDEX_NONE, false, false, false, false);
        expect(rule).toBeTruthy();
        expect(rule!.getIndex()).toBe(RULE_INDEX_NONE);
        expect(rule!.getFilterListId()).toBe(1);
        expect(rule!).toBeInstanceOf(HostRule);
    });

    it('should ignore adblock agent rules properly', () => {
        const rules = [
            '[Adblock Plus 2.0]',
            '[Adblock Plus 3.1; AdGuard]',
        ];

        rules.forEach((rule) => {
            expect(createRule(rule, 1)).toBeFalsy();
        });
    });

    it('check host and network rules recognition', () => {
        let rule;

        rule = createRule('example.org', 1, RULE_INDEX_NONE, false, false, true, true);
        expect(rule).toBeTruthy();
        expect(rule!.getIndex()).toBe(RULE_INDEX_NONE);
        expect(rule!.getFilterListId()).toBe(1);
        expect(rule!).toBeInstanceOf(NetworkRule);

        rule = createRule('example.org', 1, RULE_INDEX_NONE, false, false, false, true);
        expect(rule).toBeTruthy();
        expect(rule!.getIndex()).toBe(RULE_INDEX_NONE);
        expect(rule!.getFilterListId()).toBe(1);
        expect(rule!).toBeInstanceOf(HostRule);
    });

    // https://github.com/AdguardTeam/tsurlfilter/issues/56
    it('creates rules without domains or apps for dns compatible config', () => {
        const config = {
            engine: 'extension',
            version: '1.0',
            verbose: false,
            compatibility: CompatibilityTypes.Dns,
        };

        setConfiguration(config);
        // eslint-disable-next-line max-len
        const rule = createRule('*$denyallow=org|com|example.net', 1, RULE_INDEX_NONE, false, true, false, true);
        expect(rule).toBeTruthy();
    });
});

describe('RuleFactory shared pipeline', () => {
    it('creates correct rule types and ignores comments/empty', () => {
        expect(RuleFactory.createRule('||example.org^', 0)).toBeInstanceOf(NetworkRule);
        expect(RuleFactory.createRule('example.com##.ad', 0)).toBeInstanceOf(CosmeticRule);
        expect(RuleFactory.createRule('! comment', 0)).toBeNull();
        expect(RuleFactory.createRule('', 0)).toBeNull();
    });

    it('keeps returning NetworkRule objects across repeated calls', () => {
        // Sanity: repeated calls stay correct with the shared pipeline/options.
        for (let i = 0; i < 100; i += 1) {
            expect(RuleFactory.createRule('||a.com^$third-party', 0)).toBeInstanceOf(NetworkRule);
        }
    });
});

describe('RuleFactory whitespace handling', () => {
    it('does not reject a network rule with trailing spaces', () => {
        const rule = RuleFactory.createRule('||example.org^  ', 0);

        expect(rule).toBeInstanceOf(NetworkRule);
        expect((rule as NetworkRule).getPattern()).toBe('||example.org^');
    });

    it('does not reject a network rule with a trailing tab', () => {
        const rule = RuleFactory.createRule('||example.org^\t', 0);

        expect(rule).toBeInstanceOf(NetworkRule);
        expect((rule as NetworkRule).getPattern()).toBe('||example.org^');
    });

    it('trims whitespace before the modifier separator', () => {
        const rule = RuleFactory.createRule('||example.org^ $third-party', 0) as NetworkRule;

        expect(rule).toBeInstanceOf(NetworkRule);
        expect(rule.getPattern()).toBe('||example.org^');
        expect(rule.isOptionEnabled(NetworkRuleOption.ThirdParty)).toBe(true);
    });
});

describe('RuleFactory regex value handling', () => {
    it('parses a rule whose pattern contains =/', () => {
        // Real-world rule from ag-base.txt: `?ver=/` is part of the pattern,
        // not a regex modifier value.
        // eslint-disable-next-line max-len
        const text = '/^https:\\/\\/[0-9a-z.]+\\/wp-content\\/litespeed\\/js\\/[0-9a-f]{32}\\.js\\?ver=/$script,~third-party,match-case,replace=/function _0x[a-z0-9]{3}536\\(\\)\\{[\\s\\S]*?\\}/function _0x242536(){};/';
        const rule = RuleFactory.createRule(text, 0) as NetworkRule;

        expect(rule).toBeInstanceOf(NetworkRule);
        expect(rule.getPattern())
            .toBe('/^https:\\/\\/[0-9a-z.]+\\/wp-content\\/litespeed\\/js\\/[0-9a-f]{32}\\.js\\?ver=/');
        expect(rule.isRegexRule()).toBe(true);
        expect(rule.getAdvancedModifierValue())
            .toBe('/function _0x[a-z0-9]{3}536\\(\\)\\{[\\s\\S]*?\\}/function _0x242536(){};/');
    });

    it('parses a rule whose pattern contains f=/', () => {
        // Real-world rule from ag-base.txt: `combo/f=/` must not open a regex
        // value that swallows the `$replace` separator.
        const text = '||x-trojmiasto.pl/combo/f=/_style/$replace=/(.\\$)/\\$1.banner-maxia/,stylesheet';
        const rule = RuleFactory.createRule(text, 0) as NetworkRule;

        expect(rule).toBeInstanceOf(NetworkRule);
        expect(rule.getPattern()).toBe('||x-trojmiasto.pl/combo/f=/_style/');
        expect(rule.getAdvancedModifierValue()).toBe('/(.\\$)/\\$1.banner-maxia/');
    });

    it('keeps a regex rule with escaped $ and no modifiers', () => {
        const text = '/a\\$b\\$c/';
        const rule = RuleFactory.createRule(text, 0) as NetworkRule;

        expect(rule).toBeInstanceOf(NetworkRule);
        expect(rule.getPattern()).toBe(text);
    });

    it('parses a rule whose pattern contains a comma followed by =/', () => {
        const text = '||example.com/a,b=/c$removeparam=/x$y/';
        const rule = RuleFactory.createRule(text, 0) as NetworkRule;

        expect(rule).toBeInstanceOf(NetworkRule);
        expect(rule.getPattern()).toBe('||example.com/a,b=/c');
        expect(rule.getAdvancedModifierValue()).toBe('/x$y/');
    });

    it('keeps a regex pattern ending in $/', () => {
        const text = '/ads\\/banner\\.js$/';
        const rule = RuleFactory.createRule(text, 0) as NetworkRule;

        expect(rule).toBeInstanceOf(NetworkRule);
        expect(rule.getPattern()).toBe(text);
    });

    it('keeps a regex pattern with an escaped $', () => {
        const text = '/a\\$b/';
        const rule = RuleFactory.createRule(text, 0) as NetworkRule;

        expect(rule).toBeInstanceOf(NetworkRule);
        expect(rule.getPattern()).toBe(text);
    });

    it('keeps the separator in a rule with an escaped $ in the modifier value', () => {
        const text = '/foo.php$removeparam=a\\$b';
        const rule = RuleFactory.createRule(text, 0) as NetworkRule;

        expect(rule).toBeInstanceOf(NetworkRule);
        expect(rule.getPattern()).toBe('/foo.php');
        expect(rule.getAdvancedModifierValue()).toBe('a\\$b');
    });

    it('parses a regex value with whitespace after the assignment', () => {
        const text = '||example.com^$replace= /(a)/$1/';
        const rule = RuleFactory.createRule(text, 0) as NetworkRule;

        expect(rule).toBeInstanceOf(NetworkRule);
        expect(rule.getPattern()).toBe('||example.com^');
        expect(rule.getAdvancedModifierValue()).toBe('/(a)/$1/');
    });

    it('parses a removeparam regex value with whitespace after the assignment', () => {
        const text = '||example.com^$removeparam= /x$y/';
        const rule = RuleFactory.createRule(text, 0) as NetworkRule;

        expect(rule).toBeInstanceOf(NetworkRule);
        expect(rule.getPattern()).toBe('||example.com^');
        expect(rule.getAdvancedModifierValue()).toBe('/x$y/');
    });

    it.each([
        '/ads\\.js$|banner/',
        '/(ads\\.js$)/',
        '/a\\.js$|b\\.js$/',
        '/\\/[a-f0-9]{32}\\.js(?:$|\\?)/',
        '/[a$b]/',
        '/[$a-z]/',
        '/a$b/',
    ])('keeps a regex pattern whose $ cannot start a modifier list: %s', (text) => {
        const rule = RuleFactory.createRule(text, 0) as NetworkRule;

        expect(rule).toBeInstanceOf(NetworkRule);
        expect(rule.getPattern()).toBe(text);
    });
});

describe('RuleFactory cosmetic content parity', () => {
    const corpus = [
        '##.banner',
        'example.org##.ad',
        'example.com#@#.ad',
        '[$path=/foo]example.com##.ad', // must route via AST (has modifiers)
        "#%#//scriptlet('set-constant', 'a', 'true')",
        'example.com#$#body { color: red; }',
    ];

    it.each(corpus)('createRule content equals direct AST content for %s', (rule) => {
        const viaFactory = RuleFactory.createRule(rule, 0) as CosmeticRule;
        const viaAst = new CosmeticRule(rule, 0);
        expect(viaFactory).toBeInstanceOf(CosmeticRule);
        expect(viaFactory.getContent()).toBe(viaAst.getContent());
        expect(viaFactory.getPermittedDomains()).toEqual(viaAst.getPermittedDomains());
    });
});

describe('RuleFactory scriptlet arguments ending with an escape (F-022)', () => {
    it('creates a rule from a uBO scriptlet whose argument ends with `\\x`', () => {
        const rule = createRule(String.raw`a.com##+js(acs, Math, '\x)`, 1);
        expect(rule).toBeTruthy();
        expect(rule).toBeInstanceOf(CosmeticRule);
    });

    it('creates a rule from a uBO scriptlet whose argument is an unterminated quote ending in an escape', () => {
        const rule = createRule(String.raw`lnk2.cc##+js(aeld, , '\')`, 1);
        expect(rule).toBeTruthy();
        expect(rule).toBeInstanceOf(CosmeticRule);
    });

    it('creates a rule from the converted AdGuard form', () => {
        const rule = createRule(String.raw`tribunnews.com#%#//scriptlet('ubo-acs', 'Math', '=\'\x')`, 1);
        expect(rule).toBeTruthy();
        expect(rule).toBeInstanceOf(CosmeticRule);
    });
});

describe('RuleFactory selector complexity (F-008)', () => {
    /**
     * Builds a cosmetic rule whose selector has `count` `:not(.a)` wrappers.
     *
     * @param count Number of wrappers.
     *
     * @returns Rule text.
     */
    const notChain = (count: number): string => `example.com##div${':not(.a)'.repeat(count)} .z`;

    /**
     * Best-of-N time of `createRule` on the given rule.
     *
     * @param rule Rule text.
     * @param runs Repetitions.
     *
     * @returns Elapsed milliseconds of the fastest run.
     */
    const bestOf = (rule: string, runs = 2): number => {
        let best = Number.POSITIVE_INFINITY;
        for (let i = 0; i < runs; i += 1) {
            const started = performance.now();
            RuleFactory.createRule(rule, 1);
            best = Math.min(best, performance.now() - started);
        }
        return best;
    };

    it('scales linearly with the number of `:not()` wrappers', () => {
        bestOf(notChain(500), 1);

        const small = bestOf(notChain(4_000));
        const large = bestOf(notChain(8_000));

        // Quadratic scanning in agtree measured ≈ 4× here; linear ≈ 2×.
        expect(large / small).toBeLessThan(3);
    }, 120_000);

    it('creates a rule for a cap-size `:not()` chain without quadratic scanning', () => {
        // Same-process ratio against the 8k shape: the cap (43k) shape is
        // ~5.4× larger, so linear scanning stays far below the quadratic
        // version's ~30× (and its 8+ seconds).
        const baseline = bestOf(notChain(8_000), 1);
        const cap = bestOf(notChain(43_000), 1);

        expect(cap / baseline).toBeLessThan(15);
    }, 120_000);
});

describe('RuleFactory HTML filtering selector layout (F-007)', () => {
    it('keeps both domains for a long `$$` selector with 38 attributes', () => {
        const rule = `example.com,example.org$$div${'[tag-content="a"]'.repeat(38)}`;
        const created = RuleFactory.createRule(rule, 1, RULE_INDEX_NONE, true, true) as CosmeticRule;

        expect(created).toBeTruthy();
        expect(created.getPermittedDomains()).toEqual(['example.com', 'example.org']);
    });

    it('keeps both domains for a 20-compound `##^` selector', () => {
        const compounds = Array.from({ length: 20 }, (_, i) => `div.c${i}`).join(' ');
        const created = RuleFactory.createRule(
            `example.com,example.org##^${compounds}`,
            1,
            RULE_INDEX_NONE,
            true,
            true,
        ) as CosmeticRule;

        expect(created).toBeTruthy();
        expect(created.getPermittedDomains()).toEqual(['example.com', 'example.org']);
    });
});
