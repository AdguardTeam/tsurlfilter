import { RuleScanner } from '../../../src/filterlist/scanner/rule-scanner';
import { StringLineReader } from '../../../src/filterlist/reader/string-line-reader';
import { FileLineReader } from '../../../src/filterlist/reader/file-line-reader';
import { ScannerType } from '../../../src/filterlist/scanner/scanner-type';

describe('TestRuleScannerOfStringReader', () => {
    it('works if scanner is fine with string reader', () => {
        const filterList = '||example.org\n! test\n##banner';

        const reader = new StringLineReader(filterList);
        const scanner = new RuleScanner(reader, 1, ScannerType.All, false);

        expect(scanner.getRule()).toBeFalsy();
        expect(scanner.scan()).toBeTruthy();

        let indexedRule = scanner.getRule();
        expect(indexedRule).toBeTruthy();
        expect(indexedRule && indexedRule.index).toBe(0);

        let rule = indexedRule && indexedRule.rule;
        expect(rule).toBeTruthy();
        expect(rule!.getText()).toBe('||example.org');
        expect(rule!.getFilterListId()).toEqual(1);

        expect(scanner.scan()).toBeTruthy();

        indexedRule = scanner.getRule();
        expect(indexedRule).toBeTruthy();
        expect(indexedRule && indexedRule.index).toBe(21);

        rule = indexedRule && indexedRule.rule;
        expect(rule).toBeTruthy();
        expect(rule!.getText()).toBe('##banner');
        expect(rule!.getFilterListId()).toEqual(1);

        expect(scanner.scan()).toBeFalsy();
        expect(scanner.scan()).toBeFalsy();
    });
});

describe('TestRuleScannerOfFileReader', () => {
    it('works if scanner is fine with file reader', async () => {
        const hostsPath = './test/resources/hosts';

        const reader = new FileLineReader(hostsPath);

        const scanner = new RuleScanner(reader, 1, ScannerType.All, true);

        let rulesCount = 0;
        while (scanner.scan()) {
            const indexedRule = scanner.getRule();
            expect(indexedRule).toBeTruthy();
            expect(indexedRule!.rule).toBeTruthy();
            expect(indexedRule!.index).toBeTruthy();

            rulesCount += 1;
        }

        expect(rulesCount).toBe(55997);
        expect(scanner.scan()).toBeFalsy();
    });
});
