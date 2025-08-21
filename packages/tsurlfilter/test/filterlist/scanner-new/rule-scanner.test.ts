import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
    beforeEach,
    describe,
    expect,
    it,
} from 'vitest';

import { type ILineReader } from '../../../src/filterlist/reader/line-reader';
import { StringLineReader } from '../../../src/filterlist/reader/string-line-reader';
import { RuleScanner } from '../../../src/filterlist/scanner-new/rule-scanner';
import { ScannerType } from '../../../src/filterlist/scanner-new/scanner-type';

// eslint-disable-next-line @typescript-eslint/naming-convention, no-underscore-dangle
const __dirname = new URL('.', import.meta.url).pathname;

describe('TestRuleScannerOfBufferReader', () => {
    it('works if scanner is fine with string reader', () => {
        const rules = [
            '||example.org',
            '! test',
            '##banner',
        ];
        const text = rules.join('\n');
        const reader = new StringLineReader(text);
        const scanner = new RuleScanner(reader, 1, {
            scannerType: ScannerType.All,
            ignoreCosmetic: false,
            ignoreJS: false,
        });

        expect(scanner.getRule()).toBeFalsy();
        expect(scanner.scan()).toBeTruthy();

        let indexedRule = scanner.getRule();
        expect(indexedRule).toBeTruthy();
        expect(indexedRule && indexedRule.index).toBe(text.indexOf('||example.org'));

        let rule = indexedRule && indexedRule.rule;
        expect(rule).toBeTruthy();
        expect(rule?.text).toEqual('||example.org');
        // expect(rule!.listId).toEqual(1);

        expect(scanner.scan()).toBeTruthy();

        indexedRule = scanner.getRule();
        expect(indexedRule).toBeTruthy();
        expect(indexedRule && indexedRule.index).toBe(text.indexOf('##banner'));

        rule = indexedRule && indexedRule.rule;
        expect(rule).toBeTruthy();
        expect(rule?.text).toEqual('##banner');
        // expect(rule!.listId).toEqual(1);

        expect(scanner.scan()).toBeFalsy();
        expect(scanner.scan()).toBeFalsy();
    });
});

describe('TestRuleScannerOfFileReader', () => {
    it('works if scanner is fine with file reader', async () => {
        // If we run the tests from the Vitest workspace, we need to set the correct path
        // See https://github.com/vitest-dev/vitest/issues/5277
        const hostsPath = join(__dirname, '../../resources/hosts');
        const text = await readFile(hostsPath, 'utf-8');
        const reader = new StringLineReader(text);

        const scanner = new RuleScanner(reader, 1, {
            scannerType: ScannerType.All,
            ignoreCosmetic: true,
        });

        let rulesCount = 0;
        while (scanner.scan()) {
            const indexedRule = scanner.getRule();
            expect(indexedRule).toBeTruthy();
            expect(indexedRule!.rule).toBeTruthy();
            expect(indexedRule!.index).toBeTruthy();

            rulesCount += 1;
        }

        // FIXME (David): AG-43064, ignore unsafe rules, e.g. removeheader
        expect(rulesCount).toBe(55997);
        expect(scanner.scan()).toBeFalsy();
    });
});

describe('Rule Scanner Flags', () => {
    const rules = [
        '||one.org',
        'example.org#%#window.__gaq=undefined;',
        '||example.org^$removeheader=header-name',
        '||two.org',
    ];
    const text = rules.join('\n');

    let reader: ILineReader;

    beforeEach(() => {
        reader = new StringLineReader(text);
    });

    it('works if scanner respects ignoreJS flag', () => {
        const scanner = new RuleScanner(reader, 1, {
            scannerType: ScannerType.All,
            ignoreCosmetic: true,
            ignoreJS: true,
        });

        expect(scanner.getRule()).toBeFalsy();
        expect(scanner.scan()).toBeTruthy();

        let indexedRule = scanner.getRule();
        expect(indexedRule!.rule).toBeTruthy();
        expect(indexedRule!.rule!.text).toBe('||one.org');

        expect(scanner.scan()).toBeTruthy();

        indexedRule = scanner.getRule();
        expect(indexedRule!.rule).toBeTruthy();
        expect(indexedRule!.rule!.text).toBe('||example.org^$removeheader=header-name');

        expect(scanner.scan()).toBeTruthy();

        indexedRule = scanner.getRule();
        expect(indexedRule!.rule).toBeTruthy();
        expect(indexedRule!.rule!.text).toBe('||two.org');

        expect(scanner.scan()).toBeFalsy();
        expect(scanner.scan()).toBeFalsy();
    });
});
