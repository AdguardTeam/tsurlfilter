import { FileLineReader, RuleScanner, StringLineReader } from '../../src/filterlist/rule-scanner';

describe('TestRuleScannerOfStringReader', () => {
    it('works if scanner is fine with string reader', () => {
        const filterList = '||example.org\n! test\n##banner';

        const reader = new StringLineReader(filterList);
        const scanner = new RuleScanner(reader, 1, false);

        expect(scanner.scan()).toBeTruthy();

        let rule = scanner.getRule();

        expect(rule).toBeTruthy();
        expect(rule && rule.getText()).toBe('||example.org');
        expect(rule && rule.getFilterListId()).toEqual(1);

        expect(scanner.scan()).toBeTruthy();

        rule = scanner.getRule();

        expect(rule).toBeTruthy();
        expect(rule && rule.getText()).toBe('##banner');
        expect(rule && rule.getFilterListId()).toEqual(1);

        expect(scanner.scan()).toBeFalsy();
        expect(scanner.scan()).toBeFalsy();
    });
});

describe('TestRuleScannerOfFileReader', () => {
    it('works if scanner is fine with file reader', async () => {
        const hostsPath = './test/resources/hosts';

        const reader = new FileLineReader(hostsPath);

        const scanner = new RuleScanner(reader, 1, true);

        let rulesCount = 0;
        while (scanner.scan()) {
            const rule = scanner.getRule();
            expect(rule).toBeTruthy();

            rulesCount += 1;
        }

        expect(rulesCount).toBe(55997);
        expect(scanner.scan()).toBeFalsy();
    });
});
