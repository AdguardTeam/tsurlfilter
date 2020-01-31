import { RuleBuilder } from '../src/rule-builder';

describe('Rule Builder Test', () => {
    it('works if builder creates correct rules', () => {
        let rule;

        rule = RuleBuilder.createRule('', 1);
        expect(rule).toBeFalsy();

        rule = RuleBuilder.createRule('! comment', 1);
        expect(rule).toBeFalsy();

        rule = RuleBuilder.createRule('#', 1);
        expect(rule).toBeFalsy();

        rule = RuleBuilder.createRule('##.banner', 1);
        expect(rule).toBeTruthy();
        if (rule) {
            expect(rule.getText()).toBe('##.banner');
            expect(rule.getFilterListId()).toBe(1);
            expect(rule.isCosmetic()).toBeTruthy();
        }

        rule = RuleBuilder.createRule('||example.org^', 1);
        expect(rule).toBeTruthy();
        if (rule) {
            expect(rule.getText()).toBe('||example.org^');
            expect(rule.getFilterListId()).toBe(1);
            expect(rule.isCosmetic()).toBeFalsy();
        }
    });
});
