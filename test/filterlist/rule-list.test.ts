import { StringRuleList } from '../../src/filterlist/rule-list';

describe('TestStringRuleListScanner', () => {
    const ruleList = new StringRuleList(1, '||example.org\n! test\n##banner', false);

    it('checks common properties', () => {
        expect(ruleList.getId()).toBe(1);
    });

    const scanner = ruleList.newScanner();

    it('checks scanner', () => {
        expect(scanner).toBeTruthy();

        expect(scanner.scan()).toBeTruthy();

        let rule = scanner.getRule();
        expect(rule).toBeTruthy();
        if (rule) {
            expect(rule.rule.getText()).toBe('||example.org');
            expect(rule.rule.getFilterListId()).toBe(1);
            expect(rule.index).toBe(0);
        }

        expect(scanner.scan()).toBeTruthy();

        rule = scanner.getRule();
        expect(rule).toBeTruthy();
        if (rule) {
            expect(rule.rule.getText()).toBe('##banner');
            expect(rule.rule.getFilterListId()).toBe(1);
            expect(rule.index).toBe(21);
        }

        // Finish scanning
        expect(scanner.scan()).toBeFalsy();
    });

    it('retrieves rules by index', () => {
        let rule = ruleList.retrieveRule(0);

        expect(rule).toBeTruthy();
        if (rule) {
            expect(rule.getText()).toBe('||example.org');
            expect(rule.getFilterListId()).toBe(1);
        }

        rule = ruleList.retrieveRule(21);

        expect(rule).toBeTruthy();
        if (rule) {
            expect(rule.getText()).toBe('##banner');
            expect(rule.getFilterListId()).toBe(1);
        }
    });

    ruleList.close();
});
