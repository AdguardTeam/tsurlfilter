import { StringRuleList } from '../../src/filterlist/rule-list';
import { RuleStorage } from '../../src/filterlist/rule-storage';

describe('Test RuleStorage', () => {
    const list1 = new StringRuleList(1, '||example.org\n! test\n##banner', false);
    const list2 = new StringRuleList(2, '||example.com\n! test\n##advert', false);

    // Create storage from two lists
    const storage = new RuleStorage([list1, list2]);
    // Create a scanner instance
    const scanner = storage.createRuleStorageScanner();

    it('checks simple storage methods', () => {
        expect(storage).toBeTruthy();
        expect(scanner).toBeTruthy();
    });

    // Time to scan!
    let indexedRule;

    it('scans rule 1 from list 1', () => {
        expect(scanner.scan()).toBeTruthy();
        indexedRule = scanner.getRule();

        expect(indexedRule).toBeTruthy();
        if (indexedRule) {
            expect(indexedRule.rule).toBeTruthy();
            expect(indexedRule.rule.getText()).toBe('||example.org');
            expect(indexedRule.rule.getFilterListId()).toBe(1);
            // assert.Equal(t, "0x0000000100000000", int642hex(idx))
        }
    });

    it('scans rule 2 from list 1', () => {
        expect(scanner.scan()).toBeTruthy();
        indexedRule = scanner.getRule();

        expect(indexedRule).toBeTruthy();
        if (indexedRule) {
            expect(indexedRule.rule).toBeTruthy();
            expect(indexedRule.rule.getText()).toBe('##banner');
            expect(indexedRule.rule.getFilterListId()).toBe(1);
            // assert.Equal(t, "0x0000000100000015", int642hex(idx))
        }
    });

    it('scans rule 1 from list 2', () => {
        expect(scanner.scan()).toBeTruthy();
        indexedRule = scanner.getRule();

        expect(indexedRule).toBeTruthy();
        if (indexedRule) {
            expect(indexedRule.rule).toBeTruthy();
            expect(indexedRule.rule.getText()).toBe('||example.com');
            expect(indexedRule.rule.getFilterListId()).toBe(2);
            // assert.Equal(t, "0x0000000200000000", int642hex(idx))
        }
    });

    it('scans rule 2 from list 2', () => {
        expect(scanner.scan()).toBeTruthy();
        indexedRule = scanner.getRule();

        expect(indexedRule).toBeTruthy();
        if (indexedRule) {
            expect(indexedRule.rule).toBeTruthy();
            expect(indexedRule.rule.getText()).toBe('##advert');
            expect(indexedRule.rule.getFilterListId()).toBe(2);
            // assert.Equal(t, "0x0000000200000015", int642hex(idx))
        }
    });

    it('checks that there\'s nothing more to read', () => {
        expect(scanner.scan()).toBeFalsy();
        // Check that nothing breaks if we read a finished scanner
        expect(scanner.scan()).toBeFalsy();
    });

    // Time to retrieve!
    // TODO: Fix tests
    // it('retrieves rules by index', () => {
    //     // Rule 1 from the list 1
    //     let rule = storage.retrieveRule(0x0000000100000000);
    //
    //     expect(rule).toBeTruthy();
    //     if (rule) {
    //         expect(rule.getText()).toBe('||example.org');
    //         expect(rule.getFilterListId()).toBe(1);
    //     }
    //
    //     // Rule 2 from the list 1
    //     rule = storage.retrieveRule(0x0000000100000015);
    //
    //     expect(rule).toBeTruthy();
    //     if (rule) {
    //         expect(rule.getText()).toBe('##banner');
    //         expect(rule.getFilterListId()).toBe(1);
    //     }
    //
    //     // Rule 1 from the list 2
    //     rule = storage.retrieveRule(0x0000000200000000);
    //
    //     expect(rule).toBeTruthy();
    //     if (rule) {
    //         expect(rule.getText()).toBe('||example.com');
    //         expect(rule.getFilterListId()).toBe(1);
    //     }
    //
    //     // Rule 2 from the list 2
    //     rule = storage.retrieveRule(0x0000000200000015);
    //
    //     expect(rule).toBeTruthy();
    //     if (rule) {
    //         expect(rule.getText()).toBe('##advert');
    //         expect(rule.getFilterListId()).toBe(1);
    //     }
    // });
});
