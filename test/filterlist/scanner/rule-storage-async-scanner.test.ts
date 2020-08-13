import { StringLineReader } from '../../../src/filterlist/reader/string-line-reader';
import { RuleScanner } from '../../../src/filterlist/scanner/rule-scanner';
import { ScannerType } from '../../../src/filterlist/scanner/scanner-type';
import { RuleStorageAsyncScanner } from '../../../src/filterlist/scanner/rule-storage-async-scanner';

describe('Empty Scanners Test', () => {
    const storageScanner = new RuleStorageAsyncScanner([], 1);
    it('checks incorrectly initialized storage', async () => {
        expect(storageScanner.getRule()).toBeNull();
        expect(await storageScanner.scanAsync()).toBeFalsy();
    });
});

describe('RuleStorageAsyncScanner Test', () => {
    // Create two filter lists
    const filterList1 = '||example.org\n! test\n##banner';
    const r1 = new StringLineReader(filterList1);
    const scanner1 = new RuleScanner(r1, 1, ScannerType.All, false);

    const filterList2 = '||example.com\n! test\n##advert';
    const r2 = new StringLineReader(filterList2);
    const scanner2 = new RuleScanner(r2, 2, ScannerType.All, false);

    // Now create the storage scanner
    const storageScanner = new RuleStorageAsyncScanner([scanner1, scanner2], 1);

    let indexedRule;
    it('scans rule 1 from list 1', async () => {
        expect(await storageScanner.scanAsync()).toBeTruthy();
        indexedRule = storageScanner.getRule();

        expect(indexedRule).toBeTruthy();
        expect(indexedRule!.rule).toBeTruthy();
        expect(indexedRule!.rule.getText()).toBe('||example.org');
        expect(indexedRule!.rule.getFilterListId()).toBe(1);
        expect(indexedRule!.index.toString(16)).toBe('100000000');
    });

    it('scans rule 2 from list 1', async () => {
        expect(await storageScanner.scanAsync()).toBeTruthy();
        indexedRule = storageScanner.getRule();

        expect(indexedRule).toBeTruthy();
        expect(indexedRule!.rule).toBeTruthy();
        expect(indexedRule!.rule.getText()).toBe('##banner');
        expect(indexedRule!.rule.getFilterListId()).toBe(1);
        expect(indexedRule!.index.toString(16)).toBe('100000015');
    });

    it('scans rule 1 from list 2', async () => {
        expect(await storageScanner.scanAsync()).toBeTruthy();
        indexedRule = storageScanner.getRule();

        expect(indexedRule).toBeTruthy();
        expect(indexedRule!.rule).toBeTruthy();
        expect(indexedRule!.rule.getText()).toBe('||example.com');
        expect(indexedRule!.rule.getFilterListId()).toBe(2);
        expect(indexedRule!.index.toString(16)).toBe('200000000');
    });

    it('scans rule 2 from list 2', () => {
        expect(storageScanner.scan()).toBeTruthy();
        indexedRule = storageScanner.getRule();

        expect(indexedRule).toBeTruthy();
        expect(indexedRule!.rule).toBeTruthy();
        expect(indexedRule!.rule.getText()).toBe('##advert');
        expect(indexedRule!.rule.getFilterListId()).toBe(2);
        expect(indexedRule!.index.toString(16)).toBe('200000015');
    });

    it('checks that there\'s nothing more to read', async () => {
        expect(storageScanner.scan()).toBeFalsy();
        // Check that nothing breaks if we read a finished scanner
        expect(await storageScanner.scanAsync()).toBeFalsy();
    });
});
