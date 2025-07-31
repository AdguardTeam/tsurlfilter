import { InputByteBuffer } from '@adguard/agtree';
import escapeStringRegexp from 'escape-string-regexp';
import { describe, expect, it } from 'vitest';

import { FilterListPreprocessor } from '../../../src/filterlist/preprocessor';
import { BufferReader } from '../../../src/filterlist/reader/buffer-reader';
import { RuleScanner } from '../../../src/filterlist/scanner/rule-scanner';
import { RuleStorageScanner } from '../../../src/filterlist/scanner/rule-storage-scanner';
import { ScannerType } from '../../../src/filterlist/scanner/scanner-type';
import { getRuleSourceIndex } from '../../../src/filterlist/source-map';

describe('Empty Scanners Test', () => {
    const storageScanner = new RuleStorageScanner([]);
    it('checks incorrectly initialized storage', () => {
        expect(storageScanner.getRule()).toBeNull();
        expect(storageScanner.scan()).toBeFalsy();
    });
});

describe('RuleStorageScanner Test', () => {
    // ! WARNING: Do not run these tests individually, as the scanner state is shared between tests
    // and you may get unexpected results.

    // Create two filter lists
    const filterList1 = '||example.org\n! test\n##banner';
    const processed1 = FilterListPreprocessor.preprocess(filterList1);
    const r1 = new BufferReader(new InputByteBuffer(processed1.filterList));
    const scanner1 = new RuleScanner(r1, 1, {
        scannerType: ScannerType.All,
        ignoreCosmetic: false,
    });

    const filterList2 = '||example.com\n! test\n##advert';
    const processed2 = FilterListPreprocessor.preprocess(filterList2);
    const r2 = new BufferReader(new InputByteBuffer(processed2.filterList));
    const scanner2 = new RuleScanner(r2, 2, {
        scannerType: ScannerType.All,
        ignoreCosmetic: false,
    });

    // Now create the storage scanner
    const storageScanner = new RuleStorageScanner([scanner1, scanner2]);

    let indexedRule;

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

    it('scans rule 1 from list 1', () => {
        expect(storageScanner.scan()).toBeTruthy();
        indexedRule = storageScanner.getRule();

        expect(indexedRule).toBeTruthy();
        expect(indexedRule!.rule).toBeTruthy();
        expect(
            getRuleSourceIndex(indexedRule!.rule!.getIndex(), processed1.sourceMap),
        ).toEqual(
            getRawRuleIndex(processed1.rawFilterList, '||example.org'),
        );

        expect(indexedRule!.rule.getFilterListId()).toBe(1);
        expect(indexedRule!.index).toBe(4);
    });

    it('scans rule 2 from list 1', () => {
        expect(storageScanner.scan()).toBeTruthy();
        indexedRule = storageScanner.getRule();

        expect(indexedRule).toBeTruthy();
        expect(indexedRule!.rule).toBeTruthy();
        expect(
            getRuleSourceIndex(indexedRule!.rule!.getIndex(), processed1.sourceMap),
        ).toEqual(
            getRawRuleIndex(processed1.rawFilterList, '##banner'),
        );
        expect(indexedRule!.rule.getFilterListId()).toBe(1);
        expect(indexedRule!.index).toBe(28);
    });

    it('scans rule 1 from list 2', () => {
        expect(storageScanner.scan()).toBeTruthy();
        indexedRule = storageScanner.getRule();

        expect(indexedRule).toBeTruthy();
        expect(indexedRule!.rule).toBeTruthy();
        expect(
            getRuleSourceIndex(indexedRule!.rule!.getIndex(), processed2.sourceMap),
        ).toEqual(
            getRawRuleIndex(processed2.rawFilterList, '||example.com'),
        );
        expect(indexedRule!.rule.getFilterListId()).toBe(2);
        expect(indexedRule!.index).toBe(32772);
    });

    it('scans rule 2 from list 2', () => {
        expect(storageScanner.scan()).toBeTruthy();
        indexedRule = storageScanner.getRule();

        expect(indexedRule).toBeTruthy();
        expect(indexedRule!.rule).toBeTruthy();
        expect(
            getRuleSourceIndex(indexedRule!.rule!.getIndex(), processed2.sourceMap),
        ).toEqual(
            getRawRuleIndex(processed2.rawFilterList, '##advert'),
        );
        expect(indexedRule!.rule.getFilterListId()).toBe(2);
        expect(indexedRule!.index).toBe(32796);
    });

    it('checks that there\'s nothing more to read', () => {
        expect(storageScanner.scan()).toBeFalsy();
        // Check that nothing breaks if we read a finished scanner
        expect(storageScanner.scan()).toBeFalsy();
    });
});

// Note: this is needed because some special filter lists have negative IDs,
// like the internal Stealth Mode's filter list which has ID -1.
it('Check negative filter list ID', () => {
    const processed = FilterListPreprocessor.preprocess('||example.org');
    const reader = new BufferReader(new InputByteBuffer(processed.filterList));
    const scanner = new RuleScanner(reader, -1, {
        scannerType: ScannerType.All,
        ignoreCosmetic: false,
    });

    const storageScanner = new RuleStorageScanner([scanner]);

    expect(storageScanner.scan()).toBeTruthy();
    expect(storageScanner.getRule()).toBeTruthy();
    expect(storageScanner.getRule()!.rule.getFilterListId()).toBe(-1);

    expect(storageScanner.scan()).toBeFalsy();
});
