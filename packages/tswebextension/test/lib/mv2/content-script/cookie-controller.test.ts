/**
 * @jest-environment jsdom
 */

import { CookieController } from '@lib/mv2/content-script/cookie-controller';
import { NetworkRule, NetworkRuleOption } from '@adguard/tsurlfilter';

describe('Cookie Controller Tests', () => {
    const onAppliedCallback = jest.fn(() => {});

    beforeEach(() => {
        onAppliedCallback.mockClear();
    });

    it('checks apply simple rule', () => {
        const rules = [
            new NetworkRule('||example.org^$cookie=user_one', 1),
        ];

        const rulesData = rules.map((rule) => ({
            ruleText: rule.getText()!,
            match: rule.getAdvancedModifierValue()!,
            isThirdParty: false,
            filterId: rule.getFilterListId(),
            isAllowlist: rule.isAllowlist(),
        }));

        const controller = new CookieController(onAppliedCallback);
        controller.apply(rulesData);
        expect(onAppliedCallback).not.toBeCalled();

        document.cookie = 'user_one=test';

        controller.apply(rulesData);
        expect(onAppliedCallback).toHaveBeenCalled();
    });

    it('checks to not apply non-matching rule', () => {
        const rules = [
            new NetworkRule('||example.org^$cookie=user', 1),
        ];

        const rulesData = rules.map((rule) => ({
            ruleText: rule.getText()!,
            match: rule.getAdvancedModifierValue()!,
            isThirdParty: false,
            filterId: rule.getFilterListId(),
            isAllowlist: rule.isAllowlist(),
        }));

        const controller = new CookieController(onAppliedCallback);
        controller.apply(rulesData);
        expect(onAppliedCallback).not.toBeCalled();

        document.cookie = 'not_user=test';
        controller.apply(rulesData);
        expect(onAppliedCallback).not.toBeCalled();

        document.cookie = 'user_not=test';
        controller.apply(rulesData);
        expect(onAppliedCallback).not.toBeCalled();
    });

    it('checks apply wildcard rule', () => {
        const rules = [
            new NetworkRule('||example.org^$cookie', 1),
        ];

        const rulesData = rules.map((rule) => ({
            ruleText: rule.getText()!,
            match: rule.getAdvancedModifierValue()!,
            isThirdParty: false,
            filterId: rule.getFilterListId(),
            isAllowlist: rule.isAllowlist(),
        }));

        const controller = new CookieController(onAppliedCallback);
        document.cookie = 'user_one=test';
        controller.apply(rulesData);

        expect(onAppliedCallback).toHaveBeenCalled();
    });

    it('checks apply regexp rule', () => {
        const rules = [
            new NetworkRule('||example.org^$cookie=/user/', 1),
            new NetworkRule('||example.org^$cookie=/not_match/', 1),
        ];

        const rulesData = rules.map((rule) => ({
            ruleText: rule.getText()!,
            match: rule.getAdvancedModifierValue()!,
            isThirdParty: false,
            filterId: rule.getFilterListId(),
            isAllowlist: rule.isAllowlist(),
        }));

        const controller = new CookieController(onAppliedCallback);
        document.cookie = 'user_one=test';
        controller.apply(rulesData);

        expect(onAppliedCallback).toHaveBeenCalled();
    });

    it('checks not apply allowlisted rule', () => {
        const rules = [
            new NetworkRule('$cookie=/pick|other/,domain=example.org', 1),
            new NetworkRule('@@||example.org^$cookie=pick', 1),
        ];

        const rulesData = rules.map((rule) => ({
            ruleText: rule.getText()!,
            match: rule.getAdvancedModifierValue()!,
            isThirdParty: false,
            filterId: rule.getFilterListId(),
            isAllowlist: rule.isAllowlist(),
        }));

        const controller = new CookieController(onAppliedCallback);
        controller.apply(rulesData);
        expect(onAppliedCallback).not.toBeCalled();

        document.cookie = 'pick=test';
        controller.apply(rulesData);
        expect(onAppliedCallback).toHaveBeenLastCalledWith(expect.objectContaining({
            cookieName: 'pick',
            cookieValue: 'test',
            cookieRuleText: '@@||example.org^$cookie=pick',
        }));

        document.cookie = 'other=test';
        controller.apply(rulesData);
        expect(onAppliedCallback).toHaveBeenLastCalledWith(expect.objectContaining({
            cookieName: 'other',
            cookieValue: 'test',
            cookieRuleText: '$cookie=/pick|other/,domain=example.org',
        }));
    });

    it('checks apply important blocking rule', () => {
        const rules = [
            new NetworkRule('@@||example.org^$cookie', 1),
            new NetworkRule('||example.org^$cookie,important', 1),
        ];

        const rulesData = rules.map((rule) => ({
            ruleText: rule.getText()!,
            match: rule.getAdvancedModifierValue()!,
            isThirdParty: false,
            filterId: rule.getFilterListId(),
            isAllowlist: rule.isAllowlist(),
        }));

        const controller = new CookieController(onAppliedCallback);
        document.cookie = 'user_one=test';
        controller.apply(rulesData);

        expect(onAppliedCallback).toHaveBeenLastCalledWith(expect.objectContaining({
            cookieRuleText: '||example.org^$cookie,important',
        }));
    });

    it('check third-party rules are skipped for first-party cookies', () => {
        const rules = [
            new NetworkRule('||example.org^$third-party,cookie=/user/', 1),
        ];

        const rulesData = rules.map((rule) => ({
            ruleText: rule.getText()!,
            match: rule.getAdvancedModifierValue()!,
            isThirdParty: rule.isOptionEnabled(NetworkRuleOption.ThirdParty),
            filterId: rule.getFilterListId(),
            isAllowlist: rule.isAllowlist(),
        }));

        const controller = new CookieController(onAppliedCallback);
        document.cookie = 'user_one=test';
        controller.apply(rulesData);

        expect(onAppliedCallback).not.toBeCalled();
    });
});
