import escapeStringRegexp from 'escape-string-regexp';
import {
    beforeEach,
    describe,
    expect,
    it,
} from 'vitest';

import { RuleStorage } from '../../src/filterlist/rule-storage';
import { type RuleStorageScanner } from '../../src/filterlist/scanner/rule-storage-scanner';
import { ScannerType } from '../../src/filterlist/scanner/scanner-type';
import { StringRuleList } from '../../src/filterlist/string-rule-list';
import { NetworkRule } from '../../src/rules/network-rule';

/**
 * Helper function to get the rule index from the raw filter list by the rule text.
 *
 * @param rawFilterList Raw filter list.
 * @param rule Rule text.
 *
 * @returns Rule index or -1 if the rule couldn't be found.
 */
const getRawRuleIndex = (rawFilterList: string, rule: string): number => {
    return rawFilterList.search(new RegExp(`^${escapeStringRegexp(rule)}$`, 'm'));
};

describe('Test RuleStorage', () => {
    const rules1 = [
        '||example.org',
        '! test',
        '##banner',
    ];

    const rules2 = [
        '||example.com',
        '! test',
        '##advert',
    ];

    const rules3 = [
        '||example.net',
        '! test',
        '##advert',
    ];

    const text1 = rules1.join('\n');
    const text2 = rules2.join('\n');
    const text3 = rules3.join('\n');

    const list1 = new StringRuleList(1, text1, false, false, false);
    const list2 = new StringRuleList(2, text2, false, false, false);
    const list3 = new StringRuleList(1001, text3, false, false, false);

    let storage: RuleStorage;
    let scanner: RuleStorageScanner;

    beforeEach(() => {
        storage = new RuleStorage([list1, list2, list3]);
        scanner = storage.createRuleStorageScanner(ScannerType.All);
    });

    it('scanning', () => {
        let indexedRuleParts;

        // scans rule 1 from list 1
        expect(scanner.scan()).toBeTruthy();
        indexedRuleParts = scanner.getRuleParts();

        expect(indexedRuleParts).toBeTruthy();
        expect(indexedRuleParts!.ruleParts).toBeTruthy();
        expect(indexedRuleParts!.index).toBe(getRawRuleIndex(text1, '||example.org'));
        expect(indexedRuleParts!.listId).toBe(1);

        // scans rule 2 from list 1
        expect(scanner.scan()).toBeTruthy();
        indexedRuleParts = scanner.getRuleParts();

        expect(indexedRuleParts).toBeTruthy();
        expect(indexedRuleParts!.ruleParts).toBeTruthy();
        expect(indexedRuleParts!.index).toBe(getRawRuleIndex(text1, '##banner'));
        expect(indexedRuleParts!.listId).toBe(1);

        // scans rule 1 from list 2
        expect(scanner.scan()).toBeTruthy();
        indexedRuleParts = scanner.getRuleParts();

        expect(indexedRuleParts).toBeTruthy();
        expect(indexedRuleParts!.ruleParts).toBeTruthy();
        expect(indexedRuleParts!.index).toBe(text1.length + getRawRuleIndex(text2, '||example.com'));
        expect(indexedRuleParts!.listId).toBe(2);

        // scans rule 2 from list 2
        expect(scanner.scan()).toBeTruthy();
        indexedRuleParts = scanner.getRuleParts();

        expect(indexedRuleParts).toBeTruthy();
        expect(indexedRuleParts!.ruleParts).toBeTruthy();
        expect(indexedRuleParts!.index).toBe(text1.length + getRawRuleIndex(text2, '##advert'));
        expect(indexedRuleParts!.listId).toBe(2);

        // scans rule 1 from list 3
        expect(scanner.scan()).toBeTruthy();
        indexedRuleParts = scanner.getRuleParts();

        expect(indexedRuleParts).toBeTruthy();
        expect(indexedRuleParts!.ruleParts).toBeTruthy();
        expect(indexedRuleParts!.index).toBe(text1.length + text2.length + getRawRuleIndex(text3, '||example.net'));
        expect(indexedRuleParts!.listId).toBe(1001);

        // scans rule 2 from list 3
        expect(scanner.scan()).toBeTruthy();
        indexedRuleParts = scanner.getRuleParts();

        expect(indexedRuleParts).toBeTruthy();
        expect(indexedRuleParts!.ruleParts).toBeTruthy();
        expect(indexedRuleParts!.index).toBe(text1.length + text2.length + getRawRuleIndex(text3, '##advert'));
        expect(indexedRuleParts!.listId).toBe(1001);

        // checks that there is nothing more to read
        expect(scanner.scan()).toBeFalsy();
        // Check that nothing breaks if we read a finished scanner
        expect(scanner.scan()).toBeFalsy();
    });

    it('retrieves rules by index', () => {
        // scan all rules
        while (scanner.scan()) {
            // do nothing
        }

        // Rule 1 from the list 1
        let rule = storage.retrieveRule(getRawRuleIndex(text1, '||example.org'));

        expect(rule).toBeTruthy();
        expect(rule!.getIndex()).toBe(getRawRuleIndex(text1, '||example.org'));
        expect(rule!.getFilterListId()).toBe(1);

        // Rule 2 from the list 1
        rule = storage.retrieveRule(getRawRuleIndex(text1, '##banner'));

        expect(rule).toBeTruthy();
        expect(rule!.getIndex()).toBe(getRawRuleIndex(text1, '##banner'));
        expect(rule!.getFilterListId()).toBe(1);

        // Rule 1 from the list 2
        rule = storage.retrieveRule(text1.length + getRawRuleIndex(text2, '||example.com'));

        expect(rule).toBeTruthy();
        expect(rule!.getIndex()).toBe(getRawRuleIndex(text2, '||example.com'));
        expect(rule!.getFilterListId()).toBe(2);

        // Rule 2 from the list 2
        rule = storage.retrieveRule(text1.length + getRawRuleIndex(text2, '##advert'));

        expect(rule).toBeTruthy();
        expect(rule!.getIndex()).toBe(getRawRuleIndex(text2, '##advert'));
        expect(rule!.getFilterListId()).toBe(2);

        // Check cache
        rule = storage.retrieveRule(text1.length + getRawRuleIndex(text2, '##advert'));
        expect(rule).toBeTruthy();

        // Incorrect index
        rule = storage.retrieveRule(999999);
        expect(rule).toBeNull();
    });

    it('retrieves rules by index', () => {
        // scan all rules
        while (scanner.scan()) {
            // do nothing
        }

        // Rule 1 from the list 1
        let rule = storage.retrieveNetworkRule(0);

        expect(rule).toBeTruthy();
        expect(rule instanceof NetworkRule).toBeTruthy();
        expect(rule!.getPattern()).toBe('||example.org');
        expect(rule!.getFilterListId()).toBe(1);

        rule = storage.retrieveNetworkRule(21);
        expect(rule).toBeNull();

        rule = storage.retrieveNetworkRule(999999);
        expect(rule).toBeNull();
    });
});
