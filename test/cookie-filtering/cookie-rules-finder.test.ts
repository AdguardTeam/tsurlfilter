import CookieRulesFinder from '../../src/cookie-filtering/cookie-rules-finder';
import { NetworkRule } from '../../src/rules/network-rule';

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
});
