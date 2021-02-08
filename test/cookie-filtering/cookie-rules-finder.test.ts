import CookieRulesFinder from '../../src/cookie-filtering/cookie-rules-finder';
import { NetworkRule } from '../../src/rules/network-rule';

// describe('Cookie rules - content script rules', () => {
//     it('looks up rules', () => {
//         // TODO: Implement
//     });
// });

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
