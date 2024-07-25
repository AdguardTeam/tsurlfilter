/**
 * @jest-environment jsdom
 */

import { NetworkRuleOption } from '@adguard/tsurlfilter';
import { createNetworkRule } from '../../../helpers/rule-creator';
import { getNetworkRuleFields } from '../background/helpers/rule-fields';
import { CookieController } from '../../../../src/lib';

describe('Cookie Controller Tests', () => {
    const onAppliedCallback = jest.fn(() => {});

    beforeEach(() => {
        onAppliedCallback.mockClear();
    });

    it('checks apply simple rule', () => {
        const rules = [
            createNetworkRule('||example.org^$cookie=user_one', 1),
        ];

        const rulesData = rules.map((rule) => ({
            match: rule.getAdvancedModifierValue()!,
            isThirdParty: false,
            ...getNetworkRuleFields(rule),
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
            createNetworkRule('||example.org^$cookie=user', 1),
        ];

        const rulesData = rules.map((rule) => ({
            match: rule.getAdvancedModifierValue()!,
            isThirdParty: false,
            ...getNetworkRuleFields(rule),
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
            createNetworkRule('||example.org^$cookie', 1),
        ];

        const rulesData = rules.map((rule) => ({
            match: rule.getAdvancedModifierValue()!,
            isThirdParty: false,
            ...getNetworkRuleFields(rule),
        }));

        const controller = new CookieController(onAppliedCallback);
        document.cookie = 'user_one=test';
        controller.apply(rulesData);

        expect(onAppliedCallback).toHaveBeenCalled();
    });

    it('checks apply regexp rule', () => {
        const rules = [
            createNetworkRule('||example.org^$cookie=/user/', 1),
            createNetworkRule('||example.org^$cookie=/not_match/', 1),
        ];

        const rulesData = rules.map((rule) => ({
            match: rule.getAdvancedModifierValue()!,
            isThirdParty: false,
            ...getNetworkRuleFields(rule),
        }));

        const controller = new CookieController(onAppliedCallback);
        document.cookie = 'user_one=test';
        controller.apply(rulesData);

        expect(onAppliedCallback).toHaveBeenCalled();
    });

    it('checks not apply allowlisted rule', () => {
        const rules = [
            createNetworkRule('$cookie=/pick|other/,domain=example.org', 1, 0),
            createNetworkRule('@@||example.org^$cookie=pick', 1, 1),
        ];

        const rulesData = rules.map((rule) => ({
            match: rule.getAdvancedModifierValue()!,
            isThirdParty: false,
            ...getNetworkRuleFields(rule),
        }));

        const controller = new CookieController(onAppliedCallback);
        controller.apply(rulesData);
        expect(onAppliedCallback).not.toBeCalled();

        document.cookie = 'pick=test';
        controller.apply(rulesData);
        expect(onAppliedCallback).toHaveBeenLastCalledWith(expect.objectContaining({
            cookieName: 'pick',
            cookieValue: 'test',
            ruleIndex: 1,
        }));

        document.cookie = 'other=test';
        controller.apply(rulesData);
        expect(onAppliedCallback).toHaveBeenLastCalledWith(expect.objectContaining({
            cookieName: 'other',
            cookieValue: 'test',
            ruleIndex: 0,
        }));
    });

    it('checks apply important blocking rule', () => {
        const rules = [
            createNetworkRule('@@||example.org^$cookie', 1, 0),
            createNetworkRule('||example.org^$cookie,important', 1, 1),
        ];

        const rulesData = rules.map((rule) => ({
            match: rule.getAdvancedModifierValue()!,
            isThirdParty: false,
            ...getNetworkRuleFields(rule),
        }));

        const controller = new CookieController(onAppliedCallback);
        document.cookie = 'user_one=test';
        controller.apply(rulesData);

        expect(onAppliedCallback).toHaveBeenLastCalledWith(expect.objectContaining({
            ruleIndex: 1,
        }));
    });

    it('check third-party rules are skipped for first-party cookies', () => {
        const rules = [
            createNetworkRule('||example.org^$third-party,cookie=/user/', 1),
        ];

        const rulesData = rules.map((rule) => ({
            match: rule.getAdvancedModifierValue()!,
            isThirdParty: rule.isOptionEnabled(NetworkRuleOption.ThirdParty),
            ...getNetworkRuleFields(rule),
        }));

        const controller = new CookieController(onAppliedCallback);
        document.cookie = 'user_one=test';
        controller.apply(rulesData);

        expect(onAppliedCallback).not.toBeCalled();
    });
});
