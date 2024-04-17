import { BufferRuleList } from '../../src/filterlist/buffer-rule-list';
import { RuleStorage } from '../../src/filterlist/rule-storage';
import { NetworkRule } from '../../src';
import { ScannerType } from '../../src/filterlist/scanner/scanner-type';

describe('Test RuleStorage', () => {
    const list1 = new BufferRuleList(1, '||example.org\n! test\n##banner', false);
    const list2 = new BufferRuleList(2, '||example.com\n! test\n##advert', false);
    const list3 = new BufferRuleList(1001, '||example.net\n! test\n##advert', false);

    // Create storage from two lists
    const storage = new RuleStorage([list1, list2, list3]);
    // Create a scanner instance
    const scanner = storage.createRuleStorageScanner(ScannerType.All);

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
        expect(indexedRule!.rule).toBeTruthy();
        expect(indexedRule!.rule.getText()).toBe('||example.org');
        expect(indexedRule!.rule.getFilterListId()).toBe(1);
        expect(indexedRule!.index).toBe(0);
    });

    it('scans rule 2 from list 1', () => {
        expect(scanner.scan()).toBeTruthy();
        indexedRule = scanner.getRule();

        expect(indexedRule).toBeTruthy();
        expect(indexedRule!.rule).toBeTruthy();
        expect(indexedRule!.rule.getText()).toBe('##banner');
        expect(indexedRule!.rule.getFilterListId()).toBe(1);
        expect(indexedRule!.index).toBe(21);
    });

    it('scans rule 1 from list 2', () => {
        expect(scanner.scan()).toBeTruthy();
        indexedRule = scanner.getRule();

        expect(indexedRule).toBeTruthy();
        expect(indexedRule!.rule).toBeTruthy();
        expect(indexedRule!.rule.getText()).toBe('||example.com');
        expect(indexedRule!.rule.getFilterListId()).toBe(2);
        expect(indexedRule!.index).toBe(29);
    });

    it('scans rule 2 from list 2', () => {
        expect(scanner.scan()).toBeTruthy();
        indexedRule = scanner.getRule();

        expect(indexedRule).toBeTruthy();
        expect(indexedRule!.rule).toBeTruthy();
        expect(indexedRule!.rule.getText()).toBe('##advert');
        expect(indexedRule!.rule.getFilterListId()).toBe(2);
        expect(indexedRule!.index).toBe(50);
    });

    it('scans rule 1 from list 3', () => {
        expect(scanner.scan()).toBeTruthy();
        indexedRule = scanner.getRule();

        expect(indexedRule).toBeTruthy();
        expect(indexedRule!.rule).toBeTruthy();
        expect(indexedRule!.rule.getText()).toBe('||example.net');
        expect(indexedRule!.rule.getFilterListId()).toBe(1001);
        expect(indexedRule!.index).toBe(58);
    });

    it('scans rule 2 from list 3', () => {
        expect(scanner.scan()).toBeTruthy();
        indexedRule = scanner.getRule();

        expect(indexedRule).toBeTruthy();
        expect(indexedRule!.rule).toBeTruthy();
        expect(indexedRule!.rule.getText()).toBe('##advert');
        expect(indexedRule!.rule.getFilterListId()).toBe(1001);
        expect(indexedRule!.index).toBe(79);
    });

    it('checks that there\'s nothing more to read', () => {
        expect(scanner.scan()).toBeFalsy();
        // Check that nothing breaks if we read a finished scanner
        expect(scanner.scan()).toBeFalsy();
    });

    // Time to retrieve!
    it('retrieves rules by index', () => {
        // Rule 1 from the list 1
        let rule = storage.retrieveRule(0);

        expect(rule).toBeTruthy();
        expect(rule!.getText()).toBe('||example.org');
        expect(rule!.getFilterListId()).toBe(1);

        // Rule 2 from the list 1
        rule = storage.retrieveRule(21);

        expect(rule).toBeTruthy();
        expect(rule!.getText()).toBe('##banner');
        expect(rule!.getFilterListId()).toBe(1);

        // Rule 1 from the list 2
        rule = storage.retrieveRule(29);

        expect(rule).toBeTruthy();
        expect(rule!.getText()).toBe('||example.com');
        expect(rule!.getFilterListId()).toBe(2);

        // Rule 2 from the list 2
        rule = storage.retrieveRule(50);

        expect(rule).toBeTruthy();
        expect(rule!.getText()).toBe('##advert');
        expect(rule!.getFilterListId()).toBe(2);

        // Check cache
        rule = storage.retrieveRule(50);
        expect(rule).toBeTruthy();

        // Incorrect index
        rule = storage.retrieveRule(51);
        expect(rule).toBeNull();
    });

    it('retrieves rules by index', () => {
        // Rule 1 from the list 1
        let rule = storage.retrieveNetworkRule(0);

        expect(rule).toBeTruthy();
        expect(rule instanceof NetworkRule).toBeTruthy();
        expect(rule!.getText()).toBe('||example.org');
        expect(rule!.getFilterListId()).toBe(1);

        rule = storage.retrieveNetworkRule(21);
        expect(rule).toBeNull();

        rule = storage.retrieveNetworkRule(51);
        expect(rule).toBeNull();
    });
});
