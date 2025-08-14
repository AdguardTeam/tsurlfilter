import { describe, expect, it } from 'vitest';

import { CompatibilityTypes, setConfiguration } from '../../src/configuration';
import { CosmeticRule } from '../../src/rules/cosmetic-rule';
import { HostRule } from '../../src/rules/host-rule';
import { NetworkRule } from '../../src/rules/network-rule';
import { RULE_INDEX_NONE } from '../../src/rules/rule';
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

        rule = createRule('127.0.0.1 localhost', 1, RULE_INDEX_NONE, false, false, false);
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

        rule = createRule('example.org', 1, RULE_INDEX_NONE, false, false, true);
        expect(rule).toBeTruthy();
        expect(rule!.getIndex()).toBe(RULE_INDEX_NONE);
        expect(rule!.getFilterListId()).toBe(1);
        expect(rule!).toBeInstanceOf(NetworkRule);

        rule = createRule('example.org', 1, RULE_INDEX_NONE, false, false, false);
        expect(rule).toBeTruthy();
        expect(rule!.getIndex()).toBe(RULE_INDEX_NONE);
        expect(rule!.getFilterListId()).toBe(1);
        expect(rule!).toBeInstanceOf(HostRule);
    });

    it('respects ignore flags', () => {
        let rule;

        rule = createRule('##.banner', 1, RULE_INDEX_NONE, false, true);
        expect(rule).toBeFalsy();

        rule = createRule('||example.org^', 1, RULE_INDEX_NONE, true);
        expect(rule).toBeFalsy();

        rule = createRule('127.0.0.1 localhost', 1, RULE_INDEX_NONE, false, false, true);
        expect(rule).toBeFalsy();
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
        const rule = createRule('*$denyallow=org|com|example.net', 1, RULE_INDEX_NONE, false, true, false);
        expect(rule).toBeTruthy();
    });
});
