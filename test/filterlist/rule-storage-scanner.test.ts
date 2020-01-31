import { StringLineReader } from '../../src/filterlist/string-line-reader';
import { RuleScanner } from '../../src/filterlist/rule-scanner';
import { RuleStorageScanner } from '../../src/filterlist/rule-storage-scanner';

describe('RuleStorageScanner Test', () => {
    // TODO: Check indexes
    // func int642hex(v int64) string {
    //     return fmt.Sprintf("0x%016x", v)
    // }

    // Create two filter lists
    const filterList1 = '||example.org\n! test\n##banner';
    const r1 = new StringLineReader(filterList1);
    const scanner1 = new RuleScanner(r1, 1, false);

    const filterList2 = '||example.com\n! test\n##advert';
    const r2 = new StringLineReader(filterList2);
    const scanner2 = new RuleScanner(r2, 2, false);

    // Now create the storage scanner
    const storageScanner = new RuleStorageScanner([scanner1, scanner2]);

    let indexedRule;
    it('scans rule 1 from list 1', () => {
        expect(storageScanner.scan()).toBeTruthy();
        indexedRule = storageScanner.getRule();

        expect(indexedRule).toBeTruthy();
        if (indexedRule) {
            expect(indexedRule.rule).toBeTruthy();
            expect(indexedRule.rule.getText()).toBe('||example.org');
            expect(indexedRule.rule.getFilterListId()).toBe(1);
            // assert.Equal(t, "0x0000000100000000", int642hex(idx))
        }
    });

    it('scans rule 2 from list 1', () => {
        expect(storageScanner.scan()).toBeTruthy();
        indexedRule = storageScanner.getRule();

        expect(indexedRule).toBeTruthy();
        if (indexedRule) {
            expect(indexedRule.rule).toBeTruthy();
            expect(indexedRule.rule.getText()).toBe('##banner');
            expect(indexedRule.rule.getFilterListId()).toBe(1);
            // assert.Equal(t, "0x0000000100000015", int642hex(idx))
        }
    });

    it('scans rule 1 from list 2', () => {
        expect(storageScanner.scan()).toBeTruthy();
        indexedRule = storageScanner.getRule();

        expect(indexedRule).toBeTruthy();
        if (indexedRule) {
            expect(indexedRule.rule).toBeTruthy();
            expect(indexedRule.rule.getText()).toBe('||example.com');
            expect(indexedRule.rule.getFilterListId()).toBe(2);
            // assert.Equal(t, "0x0000000200000000", int642hex(idx))
        }
    });

    it('scans rule 2 from list 2', () => {
        expect(storageScanner.scan()).toBeTruthy();
        indexedRule = storageScanner.getRule();

        expect(indexedRule).toBeTruthy();
        if (indexedRule) {
            expect(indexedRule.rule).toBeTruthy();
            expect(indexedRule.rule.getText()).toBe('##advert');
            expect(indexedRule.rule.getFilterListId()).toBe(2);
            // assert.Equal(t, "0x0000000200000015", int642hex(idx))
        }
    });

    it('checks that there\'s nothing more to read', () => {
        expect(storageScanner.scan()).toBeFalsy();
        // Check that nothing breaks if we read a finished scanner
        expect(storageScanner.scan()).toBeFalsy();
    });
});
