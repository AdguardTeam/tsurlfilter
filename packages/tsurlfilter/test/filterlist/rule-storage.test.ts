import escapeStringRegexp from 'escape-string-regexp';
import { describe, expect, it } from 'vitest';

import { BufferRuleList } from '../../src/filterlist/buffer-rule-list';
import { FilterListPreprocessor } from '../../src/filterlist/preprocessor';
import { RuleStorage } from '../../src/filterlist/rule-storage';
import { ScannerType } from '../../src/filterlist/scanner/scanner-type';
import { getRuleSourceIndex } from '../../src/filterlist/source-map';
import { NetworkRule } from '../../src/rules/network-rule';
import { createNetworkRule } from '../helpers/rule-creator';

describe('Test RuleStorage', () => {
    // ! WARNING: Do not run these tests individually, as the scanner state is shared between tests
    // and you may get unexpected results.

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

    const processed1 = FilterListPreprocessor.preprocess('||example.org\n! test\n##banner');
    const processed2 = FilterListPreprocessor.preprocess('||example.com\n! test\n##advert');
    const processed3 = FilterListPreprocessor.preprocess('||example.net\n! test\n##advert');

    const list1 = new BufferRuleList(1, processed1.filterList, false, false, false, processed1.sourceMap);
    const list2 = new BufferRuleList(2, processed2.filterList, false, false, false, processed2.sourceMap);
    const list3 = new BufferRuleList(1001, processed3.filterList, false, false, false, processed3.sourceMap);

    // Create storage from lists
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
        expect(
            getRuleSourceIndex(indexedRule!.rule.getIndex(), processed1.sourceMap),
        ).toBe(
            getRawRuleIndex(processed1.rawFilterList, '||example.org'),
        );
        expect(indexedRule!.rule.getFilterListId()).toBe(1);
        expect(indexedRule!.index).toBe(4);
    });

    it('scans rule 2 from list 1', () => {
        expect(scanner.scan()).toBeTruthy();
        indexedRule = scanner.getRule();

        expect(indexedRule).toBeTruthy();
        expect(indexedRule!.rule).toBeTruthy();
        expect(
            getRuleSourceIndex(indexedRule!.rule.getIndex(), processed1.sourceMap),
        ).toBe(
            getRawRuleIndex(processed1.rawFilterList, '##banner'),
        );
        expect(indexedRule!.rule.getFilterListId()).toBe(1);
        expect(indexedRule!.index).toBe(28);
    });

    it('scans rule 1 from list 2', () => {
        expect(scanner.scan()).toBeTruthy();
        indexedRule = scanner.getRule();

        expect(indexedRule).toBeTruthy();
        expect(indexedRule!.rule).toBeTruthy();
        expect(
            getRuleSourceIndex(indexedRule!.rule.getIndex(), processed2.sourceMap),
        ).toBe(
            getRawRuleIndex(processed2.rawFilterList, '||example.com'),
        );
        expect(indexedRule!.rule.getFilterListId()).toBe(2);
        expect(indexedRule!.index).toBe(32772);
    });

    it('scans rule 2 from list 2', () => {
        expect(scanner.scan()).toBeTruthy();
        indexedRule = scanner.getRule();

        expect(indexedRule).toBeTruthy();
        expect(indexedRule!.rule).toBeTruthy();
        expect(
            getRuleSourceIndex(indexedRule!.rule.getIndex(), processed2.sourceMap),
        ).toBe(
            getRawRuleIndex(processed2.rawFilterList, '##advert'),
        );
        expect(indexedRule!.rule.getFilterListId()).toBe(2);
        expect(indexedRule!.index).toBe(32796);
    });

    it('scans rule 1 from list 3', () => {
        expect(scanner.scan()).toBeTruthy();
        indexedRule = scanner.getRule();

        expect(indexedRule).toBeTruthy();
        expect(indexedRule!.rule).toBeTruthy();
        expect(
            getRuleSourceIndex(indexedRule!.rule.getIndex(), processed3.sourceMap),
        ).toBe(
            getRawRuleIndex(processed3.rawFilterList, '||example.net'),
        );
        expect(indexedRule!.rule.getFilterListId()).toBe(1001);
        expect(indexedRule!.index).toBe(65540);
    });

    it('scans rule 2 from list 3', () => {
        expect(scanner.scan()).toBeTruthy();
        indexedRule = scanner.getRule();

        expect(indexedRule).toBeTruthy();
        expect(indexedRule!.rule).toBeTruthy();
        expect(
            getRuleSourceIndex(indexedRule!.rule.getIndex(), processed3.sourceMap),
        ).toBe(
            getRawRuleIndex(processed3.rawFilterList, '##advert'),
        );
        expect(indexedRule!.rule.getFilterListId()).toBe(1001);
        expect(indexedRule!.index).toBe(65564);
    });

    it('checks that there\'s nothing more to read', () => {
        expect(scanner.scan()).toBeFalsy();
        // Check that nothing breaks if we read a finished scanner
        expect(scanner.scan()).toBeFalsy();
    });

    // Time to retrieve!
    it('retrieves rules by index', () => {
        // Rule 1 from the list 1
        let rule = storage.retrieveRule(4);

        expect(rule).toBeTruthy();
        expect(
            getRuleSourceIndex(rule!.getIndex(), processed1.sourceMap),
        ).toBe(
            getRawRuleIndex(processed1.rawFilterList, '||example.org'),
        );
        expect(rule!.getFilterListId()).toBe(1);

        // Rule 2 from the list 1
        rule = storage.retrieveRule(28);

        expect(rule).toBeTruthy();
        expect(
            getRuleSourceIndex(rule!.getIndex(), processed1.sourceMap),
        ).toBe(
            getRawRuleIndex(processed1.rawFilterList, '##banner'),
        );
        expect(rule!.getFilterListId()).toBe(1);

        // Rule 1 from the list 2
        rule = storage.retrieveRule(32772);

        expect(rule).toBeTruthy();
        expect(
            getRuleSourceIndex(rule!.getIndex(), processed2.sourceMap),
        ).toBe(
            getRawRuleIndex(processed2.rawFilterList, '||example.com'),
        );
        expect(rule!.getFilterListId()).toBe(2);

        // Rule 2 from the list 2
        rule = storage.retrieveRule(32796);

        expect(rule).toBeTruthy();
        expect(
            getRuleSourceIndex(rule!.getIndex(), processed2.sourceMap),
        ).toBe(
            getRawRuleIndex(processed2.rawFilterList, '##advert'),
        );
        expect(rule!.getFilterListId()).toBe(2);

        // Check cache
        rule = storage.retrieveRule(32796);
        expect(rule).toBeTruthy();

        // Incorrect index
        rule = storage.retrieveRule(999999);
        expect(rule).toBeNull();
    });

    it('retrieves rules by index', () => {
        // Rule 1 from the list 1
        let rule = storage.retrieveNetworkRule(0);

        expect(rule).toBeTruthy();
        expect(rule instanceof NetworkRule).toBeTruthy();
        expect(rule).toMatchNetworkRule(createNetworkRule('||example.org', 1));
        expect(rule!.getFilterListId()).toBe(1);

        rule = storage.retrieveNetworkRule(21);
        expect(rule).toBeNull();

        rule = storage.retrieveNetworkRule(999999);
        expect(rule).toBeNull();
    });
});
