import { RuleFactory } from '../../src/rules/rule-factory';
import { CosmeticRule } from '../../src/rules/cosmetic-rule';
import { NetworkRule } from '../../src/rules/network-rule';
import { HostRule } from '../../src/rules/host-rule';

describe('RuleFactory Builder Test', () => {
    it('works if builder creates correct rules', () => {
        let rule;

        rule = RuleFactory.createRule('', 1);
        expect(rule).toBeFalsy();

        rule = RuleFactory.createRule('! comment', 1);
        expect(rule).toBeFalsy();

        rule = RuleFactory.createRule('#', 1);
        expect(rule).toBeFalsy();

        rule = RuleFactory.createRule('##.banner', 1);
        expect(rule).toBeTruthy();
        expect(rule!.getText()).toBe('##.banner');
        expect(rule!.getFilterListId()).toBe(1);
        expect(rule!).toBeInstanceOf(CosmeticRule);

        rule = RuleFactory.createRule('||example.org^', 1);
        expect(rule).toBeTruthy();
        expect(rule!.getText()).toBe('||example.org^');
        expect(rule!.getFilterListId()).toBe(1);
        expect(rule!).toBeInstanceOf(NetworkRule);

        rule = RuleFactory.createRule('127.0.0.1 localhost', 1, false, false, false);
        expect(rule).toBeTruthy();
        expect(rule!.getText()).toBe('127.0.0.1 localhost');
        expect(rule!.getFilterListId()).toBe(1);
        expect(rule!).toBeInstanceOf(HostRule);
    });

    it('check host and network rules recognition', () => {
        let rule;

        rule = RuleFactory.createRule('example.org', 1, false, false, true);
        expect(rule).toBeTruthy();
        expect(rule!.getText()).toBe('example.org');
        expect(rule!.getFilterListId()).toBe(1);
        expect(rule!).toBeInstanceOf(NetworkRule);

        rule = RuleFactory.createRule('example.org', 1, false, false, false);
        expect(rule).toBeTruthy();
        expect(rule!.getText()).toBe('example.org');
        expect(rule!.getFilterListId()).toBe(1);
        expect(rule!).toBeInstanceOf(HostRule);
    });

    it('respects ignore flags', () => {
        let rule;

        rule = RuleFactory.createRule('##.banner', 1, false, true);
        expect(rule).toBeFalsy();

        rule = RuleFactory.createRule('||example.org^', 1, true);
        expect(rule).toBeFalsy();

        rule = RuleFactory.createRule('127.0.0.1 localhost', 1, false, false, true);
        expect(rule).toBeFalsy();
    });
});

describe('RuleFactory isCosmetic', () => {
    it('works if it detects cosmetic rules', () => {
        expect(RuleFactory.isCosmetic('$$script')).toEqual(true);
        expect(RuleFactory.isCosmetic('#%#//scriptlet("test")')).toEqual(true);
        expect(RuleFactory.isCosmetic('example.org##banenr')).toEqual(true);

        expect(RuleFactory.isCosmetic('||example.org^')).toEqual(false);
        expect(RuleFactory.isCosmetic('$domain=example.org')).toEqual(false);
    });
});

describe('RuleFactory isComment', () => {
    it('works if it detects comments', () => {
        expect(RuleFactory.isComment('! comment')).toEqual(true);
        expect(RuleFactory.isComment('!! comment')).toEqual(true);
        expect(RuleFactory.isComment('!+ comment')).toEqual(true);
        expect(RuleFactory.isComment('#')).toEqual(true);
        expect(RuleFactory.isComment('##.banner')).toEqual(false);

        expect(RuleFactory.isComment('||example.org^')).toEqual(false);
        expect(RuleFactory.isComment('$domain=example.org')).toEqual(false);
    });
});
