import { StringLineReader } from '../../../src/filterlist/reader/string-line-reader';
import { RuleScanner } from '../../../src/filterlist/scanner/rule-scanner';
import { RuleStorageScanner } from '../../../src/filterlist/scanner/rule-storage-scanner';
import { ScannerType } from '../../../src/filterlist/scanner/scanner-type';

describe('Empty Scanners Test', () => {
    const storageScanner = new RuleStorageScanner([]);
    it('checks incorrectly initialized storage', () => {
        expect(storageScanner.getRule()).toBeNull();
        expect(storageScanner.scan()).toBeFalsy();
    });
});

describe('RuleStorageScanner Test', () => {
    // Create two filter lists
    const filterList1 = '||example.org\n! test\n##banner';
    const r1 = new StringLineReader(filterList1);
    const scanner1 = new RuleScanner(r1, 1, {
        scannerType: ScannerType.All,
        ignoreCosmetic: false,
    });

    const filterList2 = '||example.com\n! test\n##advert';
    const r2 = new StringLineReader(filterList2);
    const scanner2 = new RuleScanner(r2, 2, {
        scannerType: ScannerType.All,
        ignoreCosmetic: false,
    });

    // Now create the storage scanner
    const storageScanner = new RuleStorageScanner([scanner1, scanner2]);

    let indexedRule;
    it('scans rule 1 from list 1', () => {
        expect(storageScanner.scan()).toBeTruthy();
        indexedRule = storageScanner.getRule();

        expect(indexedRule).toBeTruthy();
        expect(indexedRule!.rule).toBeTruthy();
        expect(indexedRule!.rule.getText()).toBe('||example.org');
        expect(indexedRule!.rule.getFilterListId()).toBe(1);
        expect(indexedRule!.index).toBe(0);
    });

    it('scans rule 2 from list 1', () => {
        expect(storageScanner.scan()).toBeTruthy();
        indexedRule = storageScanner.getRule();

        expect(indexedRule).toBeTruthy();
        expect(indexedRule!.rule).toBeTruthy();
        expect(indexedRule!.rule.getText()).toBe('##banner');
        expect(indexedRule!.rule.getFilterListId()).toBe(1);
        expect(indexedRule!.index).toBe(21);
    });

    it('scans rule 1 from list 2', () => {
        expect(storageScanner.scan()).toBeTruthy();
        indexedRule = storageScanner.getRule();

        expect(indexedRule).toBeTruthy();
        expect(indexedRule!.rule).toBeTruthy();
        expect(indexedRule!.rule.getText()).toBe('||example.com');
        expect(indexedRule!.rule.getFilterListId()).toBe(2);
        expect(indexedRule!.index).toBe(29);
    });

    it('scans rule 2 from list 2', () => {
        expect(storageScanner.scan()).toBeTruthy();
        indexedRule = storageScanner.getRule();

        expect(indexedRule).toBeTruthy();
        expect(indexedRule!.rule).toBeTruthy();
        expect(indexedRule!.rule.getText()).toBe('##advert');
        expect(indexedRule!.rule.getFilterListId()).toBe(2);
        expect(indexedRule!.index).toBe(50);
    });

    it('checks that there\'s nothing more to read', () => {
        expect(storageScanner.scan()).toBeFalsy();
        // Check that nothing breaks if we read a finished scanner
        expect(storageScanner.scan()).toBeFalsy();
    });
});

// Note: this is needed because some special filter lists have negative IDs,
// like the internal Stealth Mode's filter list which has ID -1.
describe('Check negative filter list ID', () => {
    it('works with negative filter id', () => {
        const filterList = '||example.org';

        const lineReader = new StringLineReader(filterList);
        const scanner = new RuleScanner(lineReader, -1, {
            scannerType: ScannerType.All,
            ignoreCosmetic: false,
        });

        const storageScanner = new RuleStorageScanner([scanner]);

        expect(storageScanner.scan()).toBeTruthy();
        expect(storageScanner.getRule()).toBeTruthy();
        expect(storageScanner.getRule()!.rule.getFilterListId()).toBe(-1);

        expect(storageScanner.scan()).toBeFalsy();
    });
});
