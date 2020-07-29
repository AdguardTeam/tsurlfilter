import { RuleValidator } from '../../src/rules/rule-validator';
import { RuleUtils } from '../../src';

describe('RuleValidator', () => {
    it('considers comments as valid rules', () => {
        const rule = '# this is comment';
        expect(RuleValidator.validate(rule)).toEqual(RuleValidator.createValidationResult(true));
    });
});

describe('RuleValidator isComment', () => {
    it('works if it detects comments', () => {
        expect(RuleValidator.isComment('! comment')).toEqual(true);
        expect(RuleValidator.isComment('!! comment')).toEqual(true);
        expect(RuleValidator.isComment('!+ comment')).toEqual(true);
        expect(RuleValidator.isComment('#')).toEqual(true);
        expect(RuleValidator.isComment('##.banner')).toEqual(false);

        expect(RuleValidator.isComment('||example.org^')).toEqual(false);
        expect(RuleValidator.isComment('$domain=example.org')).toEqual(false);
    });
});
