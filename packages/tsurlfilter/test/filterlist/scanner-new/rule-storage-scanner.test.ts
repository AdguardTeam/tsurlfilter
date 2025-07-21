import { describe, it, expect } from 'vitest';

import { RuleScanner } from '../../../src/filterlist/scanner-new/rule-scanner';
import { RuleStorageScanner } from '../../../src/filterlist/scanner-new/rule-storage-scanner';
import { ScannerType } from '../../../src/filterlist/scanner-new/scanner-type';
import { StringLineReader } from '../../../src/filterlist/reader/string-line-reader';

describe('Empty Scanners Test', () => {
    const storageScanner = new RuleStorageScanner([]);
    it('checks incorrectly initialized storage', () => {
        expect(storageScanner.getRule()).toBeNull();
        expect(storageScanner.scan()).toBeFalsy();
    });
});

it('scanning', () => {
    const rules1 = [
        '||example.org',
        '! test',
        '##banner',
    ];
    const text1 = rules1.join('\n');
    const reader1 = new StringLineReader(text1);
    const scanner1 = new RuleScanner(reader1, 1, {
        scannerType: ScannerType.All,
        ignoreCosmetic: false,
    });

    const rules2 = [
        '||example.com',
        '! test',
        '##advert',
    ];
    const text2 = rules2.join('\n');
    const reader2 = new StringLineReader(text2);
    const scanner2 = new RuleScanner(reader2, 2, {
        scannerType: ScannerType.All,
        ignoreCosmetic: false,
    });

    const storageScanner = new RuleStorageScanner([scanner1, scanner2]);

    let indexedRule;

    // scans rule 1 from list 1'
    expect(storageScanner.scan()).toBeTruthy();
    indexedRule = storageScanner.getRule();

    expect(indexedRule).toBeTruthy();
    expect(indexedRule!.rule).toBeTruthy();
    expect(indexedRule!.index).toEqual(text1.indexOf('||example.org'));
    expect(indexedRule!.listId).toBe(1);

    // scans rule 2 from list 1
    expect(storageScanner.scan()).toBeTruthy();
    indexedRule = storageScanner.getRule();

    expect(indexedRule).toBeTruthy();
    expect(indexedRule!.rule).toBeTruthy();
    expect(indexedRule!.index).toEqual(text1.indexOf('##banner'));
    expect(indexedRule!.listId).toBe(1);

    // scans rule 1 from list 2
    expect(storageScanner.scan()).toBeTruthy();
    indexedRule = storageScanner.getRule();

    expect(indexedRule).toBeTruthy();
    expect(indexedRule!.rule).toBeTruthy();
    expect(indexedRule!.index).toEqual(text1.length + text2.indexOf('||example.com'));
    expect(indexedRule!.listId).toBe(2);

    // scans rule 2 from list 2
    expect(storageScanner.scan()).toBeTruthy();
    indexedRule = storageScanner.getRule();

    expect(indexedRule).toBeTruthy();
    expect(indexedRule!.rule).toBeTruthy();
    expect(indexedRule!.index).toEqual(text1.length + text2.indexOf('##advert'));
    expect(indexedRule!.listId).toBe(2);

    // checks that there is nothing more to read
    expect(storageScanner.scan()).toBeFalsy();
    // check that nothing breaks if we read a finished scanner
    expect(storageScanner.scan()).toBeFalsy();
});

// Note: this is needed because some special filter lists have negative IDs,
// like the internal Stealth Mode's filter list which has ID -1.
it('Check negative filter list ID', () => {
    const text = '||example.org';
    const reader = new StringLineReader(text);
    const scanner = new RuleScanner(reader, -1, {
        scannerType: ScannerType.All,
        ignoreCosmetic: false,
    });

    const storageScanner = new RuleStorageScanner([scanner]);

    expect(storageScanner.scan()).toBeTruthy();
    expect(storageScanner.getRule()).toBeTruthy();
    expect(storageScanner.getRule()!.listId).toBe(-1);

    expect(storageScanner.scan()).toBeFalsy();
});
