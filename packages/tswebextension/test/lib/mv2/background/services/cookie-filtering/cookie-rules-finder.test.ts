import { NetworkRule } from '@adguard/tsurlfilter';

import CookieRulesFinder from '@lib/mv2/background/services/cookie-filtering/cookie-rules-finder';

describe('Cookie rules - content script rules', () => {
    it('looks up rules', () => {
        const allCookieRule = new NetworkRule('$cookie=all', 0);
        const blockingCookieRule = new NetworkRule('example.org$cookie=test', 0);
        const modifyingCookieRule = new NetworkRule('example.org$cookie=test;maxAge=15;sameSite=lax', 0);
        const found = CookieRulesFinder.getBlockingRules('http://example.org', [
            allCookieRule,
            blockingCookieRule,
            modifyingCookieRule,
        ]);

        expect(found).toHaveLength(2);
        expect(found).toContain(allCookieRule);
        expect(found).toContain(blockingCookieRule);
    });
});

describe('Cookie rules - lookup rules', () => {
    it('looks up blocking rules', () => {
        let rule = CookieRulesFinder.lookupNotModifyingRule('test', [
            new NetworkRule('$cookie=test', 0),
        ], false);
        expect(rule).not.toBeNull();

        rule = CookieRulesFinder.lookupNotModifyingRule('not_test', [
            new NetworkRule('$cookie=test', 0),
        ], false);
        expect(rule).toBeNull();

        rule = CookieRulesFinder.lookupNotModifyingRule('test', [
            new NetworkRule('$cookie=not_test', 0),
            new NetworkRule('$cookie=test', 0),
        ], false);
        expect(rule).not.toBeNull();
        expect(rule!.getText()).toBe('$cookie=test');

        rule = CookieRulesFinder.lookupNotModifyingRule('test', [
            new NetworkRule('$cookie=test;maxAge=15;sameSite=lax', 0),
        ], false);
        expect(rule).toBeNull();
    });

    it('looks up blocking rules - third-party cookie', () => {
        let rule = CookieRulesFinder.lookupNotModifyingRule('test', [
            new NetworkRule('$cookie=test', 0),
        ], true);
        expect(rule).not.toBeNull();

        rule = CookieRulesFinder.lookupNotModifyingRule('test', [
            new NetworkRule('$third-party,cookie=test', 0),
        ], false);
        expect(rule).toBeNull();

        rule = CookieRulesFinder.lookupNotModifyingRule('test', [
            new NetworkRule('$third-party,cookie=test', 0),
        ], true);
        expect(rule).not.toBeNull();
    });

    it('looks up blocking rules - cookie specific allowlist', () => {
        let rule = CookieRulesFinder.lookupNotModifyingRule('pick', [
            new NetworkRule('$cookie=pick', 0),
            new NetworkRule('@@||example.org^$cookie=pick', 0),
        ], true);
        expect(rule).not.toBeNull();
        expect(rule!.isAllowlist()).toBeTruthy();

        rule = CookieRulesFinder.lookupNotModifyingRule('pick', [
            new NetworkRule('example.org$cookie=/pick|pack/', 0),
            new NetworkRule('@@||example.org^$cookie=pick', 0),
        ], true);
        expect(rule).not.toBeNull();
        expect(rule!.isAllowlist()).toBeTruthy();

        rule = CookieRulesFinder.lookupNotModifyingRule('pick', [
            new NetworkRule('example.org$cookie=/pick|pack/', 0),
            new NetworkRule('@@||example.org^$cookie=/pick|other/', 0),
        ], true);
        expect(rule).not.toBeNull();
        expect(rule!.isAllowlist()).toBeTruthy();

        rule = CookieRulesFinder.lookupNotModifyingRule('pack', [
            new NetworkRule('example.org$cookie=/pick|pack/', 0),
            new NetworkRule('@@||example.org^$cookie=/pick|other/', 0),
        ], true);
        expect(rule).not.toBeNull();
        expect(rule!.isAllowlist()).not.toBeTruthy();

        rule = CookieRulesFinder.lookupNotModifyingRule('other', [
            new NetworkRule('example.org$cookie=/pick|pack/', 0),
            new NetworkRule('@@||example.org^$cookie=/pick|other/', 0),
        ], true);
        expect(rule).not.toBeNull();
        expect(rule!.isAllowlist()).toBeTruthy();
    });

    it('looks up modifying rules', () => {
        let rules = CookieRulesFinder.lookupModifyingRules('test', [
            new NetworkRule('$cookie=test', 0),
        ], false);
        expect(rules).toHaveLength(0);

        rules = CookieRulesFinder.lookupModifyingRules('test', [
            new NetworkRule('$cookie=test;maxAge=15;sameSite=lax', 0),
        ], false);
        expect(rules).toHaveLength(1);
    });

    it('looks up modifying rules - cookie specific allowlist', () => {
        const rule = CookieRulesFinder.lookupModifyingRules('pick', [
            new NetworkRule('$cookie=pick;maxAge=15;sameSite=lax', 0),
            new NetworkRule('@@||example.org^$cookie=pick', 0),
        ], false);
        expect(rule).not.toBeNull();
        expect(rule).toHaveLength(1);
        expect(rule[0].isAllowlist()).toBeTruthy();
    });
});
