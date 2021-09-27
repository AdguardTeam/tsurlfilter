import { LIST_ID_MAX_VALUE, StringRuleList } from '../../src/filterlist/rule-list';
import { ScannerType } from '../../src/filterlist/scanner/scanner-type';

describe('TestStringRuleListScanner', () => {
    const ruleList = new StringRuleList(1, '||example.org\n! test\n##banner', false);

    it('checks common properties', () => {
        expect(ruleList.getId()).toBe(1);
    });

    it('checks max list id', () => {
        expect(() => {
            new StringRuleList(LIST_ID_MAX_VALUE, '||example.org\n! test\n##banner');
        }).toThrowError();
    });

    const scanner = ruleList.newScanner(ScannerType.All);

    it('checks scanner', () => {
        expect(scanner).toBeTruthy();

        expect(scanner.scan()).toBeTruthy();

        let rule = scanner.getRule();
        expect(rule).toBeTruthy();
        expect(rule!.rule.getText()).toBe('||example.org');
        expect(rule!.rule.getFilterListId()).toBe(1);
        expect(rule!.index).toBe(0);

        expect(scanner.scan()).toBeTruthy();

        rule = scanner.getRule();
        expect(rule).toBeTruthy();
        expect(rule!.rule.getText()).toBe('##banner');
        expect(rule!.rule.getFilterListId()).toBe(1);
        expect(rule!.index).toBe(21);

        // Finish scanning
        expect(scanner.scan()).toBeFalsy();
    });

    it('retrieves rules by index', () => {
        let rule = ruleList.retrieveRuleText(0);

        expect(rule).toBeTruthy();
        expect(rule!).toBe('||example.org');

        rule = ruleList.retrieveRuleText(21);

        expect(rule).toBeTruthy();
        expect(rule!).toBe('##banner');

        rule = ruleList.retrieveRuleText(-1);
        expect(rule).toBeNull();

        rule = ruleList.retrieveRuleText(999);
        expect(rule).toBeNull();
    });

    ruleList.close();
});
