import { describe, expect, it } from 'vitest';

import { CompatibilityTypes, setConfiguration } from '../../src/configuration';
import { CosmeticRule } from '../../src/rules/cosmetic-rule';
import { HostRule } from '../../src/rules/host-rule';
import { NetworkRule } from '../../src/rules/network-rule';
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

    it('reuses a single options object across calls (no per-call allocation)', () => {
        // Sanity: repeated calls stay correct with the shared pipeline/options.
        for (let i = 0; i < 100; i += 1) {
            expect(RuleFactory.createRule('||a.com^$third-party', 0)).toBeInstanceOf(NetworkRule);
        }
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
