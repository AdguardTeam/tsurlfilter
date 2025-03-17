import { describe, expect, it } from 'vitest';

import { createNetworkRule } from '../../../../../helpers/rule-creator';
import CookieRulesFinder from '../../../../../../src/lib/common/cookie-filtering/cookie-rules-finder';

describe('Cookie rules - content script rules', () => {
    it('looks up rules', () => {
        const allCookieRule = createNetworkRule('$cookie=all', 0);
        const blockingCookieRule = createNetworkRule('example.org$cookie=test', 0);
        const modifyingCookieRule = createNetworkRule('example.org$cookie=test;maxAge=15;sameSite=lax', 0);
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
            createNetworkRule('$cookie=test', 0),
        ], false);
        expect(rule).not.toBeNull();

        rule = CookieRulesFinder.lookupNotModifyingRule('not_test', [
            createNetworkRule('$cookie=test', 0),
        ], false);
        expect(rule).toBeNull();

        rule = CookieRulesFinder.lookupNotModifyingRule('test', [
            createNetworkRule('$cookie=not_test', 0),
            createNetworkRule('$cookie=test', 0),
        ], false);
        expect(rule).not.toBeNull();
        expect(rule).toEqual(createNetworkRule('$cookie=test'));

        rule = CookieRulesFinder.lookupNotModifyingRule('test', [
            createNetworkRule('$cookie=test;maxAge=15;sameSite=lax', 0),
        ], false);
        expect(rule).toBeNull();
    });

    it('looks up blocking rules - third-party cookie', () => {
        let rule = CookieRulesFinder.lookupNotModifyingRule('test', [
            createNetworkRule('$cookie=test', 0),
        ], true);
        expect(rule).not.toBeNull();

        rule = CookieRulesFinder.lookupNotModifyingRule('test', [
            createNetworkRule('$third-party,cookie=test', 0),
        ], false);
        expect(rule).toBeNull();

        rule = CookieRulesFinder.lookupNotModifyingRule('test', [
            createNetworkRule('$third-party,cookie=test', 0),
        ], true);
        expect(rule).not.toBeNull();
    });

    it('looks up blocking rules - cookie specific allowlist', () => {
        let rule = CookieRulesFinder.lookupNotModifyingRule('pick', [
            createNetworkRule('$cookie=pick', 0),
            createNetworkRule('@@||example.org^$cookie=pick', 0),
        ], true);
        expect(rule).not.toBeNull();
        expect(rule!.isAllowlist()).toBeTruthy();

        rule = CookieRulesFinder.lookupNotModifyingRule('pick', [
            createNetworkRule('example.org$cookie=/pick|pack/', 0),
            createNetworkRule('@@||example.org^$cookie=pick', 0),
        ], true);
        expect(rule).not.toBeNull();
        expect(rule!.isAllowlist()).toBeTruthy();

        rule = CookieRulesFinder.lookupNotModifyingRule('pick', [
            createNetworkRule('example.org$cookie=/pick|pack/', 0),
            createNetworkRule('@@||example.org^$cookie=/pick|other/', 0),
        ], true);
        expect(rule).not.toBeNull();
        expect(rule!.isAllowlist()).toBeTruthy();

        rule = CookieRulesFinder.lookupNotModifyingRule('pack', [
            createNetworkRule('example.org$cookie=/pick|pack/', 0),
            createNetworkRule('@@||example.org^$cookie=/pick|other/', 0),
        ], true);
        expect(rule).not.toBeNull();
        expect(rule!.isAllowlist()).not.toBeTruthy();

        rule = CookieRulesFinder.lookupNotModifyingRule('other', [
            createNetworkRule('example.org$cookie=/pick|pack/', 0),
            createNetworkRule('@@||example.org^$cookie=/pick|other/', 0),
        ], true);
        expect(rule).not.toBeNull();
        expect(rule!.isAllowlist()).toBeTruthy();
    });

    it('looks up modifying rules', () => {
        let rules = CookieRulesFinder.lookupModifyingRules('test', [
            createNetworkRule('$cookie=test', 0),
        ], false);
        expect(rules).toHaveLength(0);

        rules = CookieRulesFinder.lookupModifyingRules('test', [
            createNetworkRule('$cookie=test;maxAge=15;sameSite=lax', 0),
        ], false);
        expect(rules).toHaveLength(1);
    });

    it('looks up modifying rules - cookie specific allowlist', () => {
        const rule = CookieRulesFinder.lookupModifyingRules('pick', [
            createNetworkRule('$cookie=pick;maxAge=15;sameSite=lax', 0),
            createNetworkRule('@@||example.org^$cookie=pick', 0),
        ], false);
        expect(rule).not.toBeNull();
        expect(rule).toHaveLength(1);
        expect(rule[0].isAllowlist()).toBeTruthy();
    });
});
