import { RuleValidator } from '../../src/rules/rule-validator';

describe('RuleValidator', () => {
    it('considers comments as valid rules', () => {
        const rule = '# this is comment';
        expect(RuleValidator.validate(rule)).toEqual(RuleValidator.createResult(true));
    });
});
