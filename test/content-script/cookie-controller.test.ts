/**
 * @jest-environment jsdom
 */

import CookieController from '../../src/content-script/cookie-controller';
import { NetworkRule, NetworkRuleOption } from '../../src/rules/network-rule';

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
        }));

        const controller = new CookieController(onAppliedCallback);
        controller.apply(rulesData);
        expect(onAppliedCallback).not.toBeCalled();

        document.cookie = 'user_one=test';

        controller.apply(rulesData);
        expect(onAppliedCallback).toHaveBeenLastCalledWith('||example.org^$cookie=user_one');
    });

    it('checks apply wildcard rule', () => {
        const rules = [
            new NetworkRule('||example.org^$cookie', 1),
        ];

        const rulesData = rules.map((rule) => ({
            ruleText: rule.getText()!,
            match: rule.getAdvancedModifierValue()!,
            isThirdParty: false,
        }));

        const controller = new CookieController(onAppliedCallback);
        document.cookie = 'user_one=test';
        controller.apply(rulesData);

        expect(onAppliedCallback).toHaveBeenLastCalledWith('||example.org^$cookie');
    });

    it('checks apply regexp rule', () => {
        const rules = [
            new NetworkRule('||example.org^$cookie=/user/', 1),
        ];

        const rulesData = rules.map((rule) => ({
            ruleText: rule.getText()!,
            match: rule.getAdvancedModifierValue()!,
            isThirdParty: false,
        }));

        const controller = new CookieController(onAppliedCallback);
        document.cookie = 'user_one=test';
        controller.apply(rulesData);

        expect(onAppliedCallback).toHaveBeenLastCalledWith('||example.org^$cookie=/user/');
    });

    it('check third-party rules are skipped for first-party cookies', () => {
        const rules = [
            new NetworkRule('||example.org^$third-party,cookie=/user/', 1),
        ];

        const rulesData = rules.map((rule) => ({
            ruleText: rule.getText()!,
            match: rule.getAdvancedModifierValue()!,
            isThirdParty: rule.isOptionEnabled(NetworkRuleOption.ThirdParty),
        }));

        const controller = new CookieController(onAppliedCallback);
        document.cookie = 'user_one=test';
        controller.apply(rulesData);

        expect(onAppliedCallback).not.toBeCalled();
    });
});
