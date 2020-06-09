import { RuleUtils } from '../../src/rules/rule-utils';
import { CosmeticRule } from '../../src/rules/cosmetic-rule';
import { NetworkRule } from '../../src/rules/network-rule';
import { HostRule } from '../../src/rules/host-rule';

describe('Rule Utils Builder Test', () => {
    it('works if builder creates correct rules', () => {
        let rule;

        rule = RuleUtils.createRule('', 1);
        expect(rule).toBeFalsy();

        rule = RuleUtils.createRule('! comment', 1);
        expect(rule).toBeFalsy();

        rule = RuleUtils.createRule('#', 1);
        expect(rule).toBeFalsy();

        rule = RuleUtils.createRule('##.banner', 1);
        expect(rule).toBeTruthy();
        expect(rule!.getText()).toBe('##.banner');
        expect(rule!.getFilterListId()).toBe(1);
        expect(rule!).toBeInstanceOf(CosmeticRule);

        rule = RuleUtils.createRule('||example.org^', 1);
        expect(rule).toBeTruthy();
        expect(rule!.getText()).toBe('||example.org^');
        expect(rule!.getFilterListId()).toBe(1);
        expect(rule!).toBeInstanceOf(NetworkRule);

        rule = RuleUtils.createRule('127.0.0.1 localhost', 1);
        expect(rule).toBeTruthy();
        expect(rule!.getText()).toBe('127.0.0.1 localhost');
        expect(rule!.getFilterListId()).toBe(1);
        expect(rule!).toBeInstanceOf(HostRule);
    });
});

describe('RuleUtils isComment', () => {
    it('works if it detects comments', () => {
        expect(RuleUtils.isComment('! comment')).toEqual(true);
        expect(RuleUtils.isComment('!! comment')).toEqual(true);
        expect(RuleUtils.isComment('!+ comment')).toEqual(true);
        expect(RuleUtils.isComment('#')).toEqual(true);
        expect(RuleUtils.isComment('##.banner')).toEqual(false);

        expect(RuleUtils.isComment('||example.org^')).toEqual(false);
        expect(RuleUtils.isComment('$domain=example.org')).toEqual(false);
    });
});

describe('RuleUtils isCosmetic', () => {
    it('works if it detects cosmetic rules', () => {
        expect(RuleUtils.isCosmetic('$$script')).toEqual(true);
        expect(RuleUtils.isCosmetic('#%#//scriptlet("test")')).toEqual(true);
        expect(RuleUtils.isCosmetic('example.org##banenr')).toEqual(true);

        expect(RuleUtils.isCosmetic('||example.org^')).toEqual(false);
        expect(RuleUtils.isCosmetic('$domain=example.org')).toEqual(false);
    });
});
