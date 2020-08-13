import { RuleValidator } from '../../src/rules/rule-validator';

describe('RuleValidator', () => {
    it('considers comments as valid rules', () => {
        const rule = '# this is comment';
        expect(RuleValidator.validate(rule)).toEqual(RuleValidator.createValidationResult(true));
    });

    it('detects invalid scriptlets rules', () => {
        const invalidScriptletName = 'ubo-abort-current-inline-scripts.js';
        const validScriptletName = 'ubo-abort-current-inline-script.js';
        const getRule = (name: string): string => `test.com#%#//scriptlet("${name}", "Math.random", "adbDetect")`;

        const invalidRule = getRule(invalidScriptletName);
        expect(RuleValidator.validate(invalidRule).valid).toBeFalsy();

        const validRule = getRule(validScriptletName);
        expect(RuleValidator.validate(validRule).valid).toBeTruthy();
    });

    it('validates regexp rules', () => {
        // eslint-disable-next-line no-useless-escape
        const invalidRuleText = '/ex[[ampl[[e\.com\///.*\/banner/$script';
        expect(RuleValidator.validate(invalidRuleText).valid).toBeFalsy();

        // eslint-disable-next-line no-useless-escape
        const validRuleText = '/^https:\/\/([a-z]+\.)?sythe\.org\/\[=%#@$&!^].*[\w\W]{20,}/$image';
        expect(RuleValidator.validate(validRuleText).valid).toBeTruthy();
    });
});
