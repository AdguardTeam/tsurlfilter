import { InputByteBuffer } from '@adguard/agtree';
import escapeStringRegexp from 'escape-string-regexp';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { FilterListPreprocessor } from '../../../src/filterlist/preprocessor';
import { BufferReader } from '../../../src/filterlist/reader/buffer-reader';
import { RuleScanner } from '../../../src/filterlist/scanner/rule-scanner';
import { ScannerType } from '../../../src/filterlist/scanner/scanner-type';
import { getRuleSourceIndex } from '../../../src/filterlist/source-map';

// eslint-disable-next-line @typescript-eslint/naming-convention, no-underscore-dangle
const __dirname = new URL('.', import.meta.url).pathname;

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

describe('TestRuleScannerOfBufferReader', () => {
    it('works if scanner is fine with string reader', () => {
        const filterList = '||example.org\n! test\n##banner';
        const processed = FilterListPreprocessor.preprocess(filterList);

        const reader = new BufferReader(new InputByteBuffer(processed.filterList));
        const scanner = new RuleScanner(reader, 1, {
            scannerType: ScannerType.All, ignoreCosmetic: false,
        });

        expect(scanner.getRule()).toBeFalsy();
        expect(scanner.scan()).toBeTruthy();

        let indexedRule = scanner.getRule();
        expect(indexedRule).toBeTruthy();
        expect(indexedRule && indexedRule.index).toBe(4);

        let rule = indexedRule && indexedRule.rule;
        expect(rule).toBeTruthy();
        expect(
            getRuleSourceIndex(rule!.getIndex(), processed.sourceMap),
        ).toEqual(
            getRawRuleIndex(filterList, '||example.org'),
        );
        expect(rule!.getFilterListId()).toEqual(1);

        expect(scanner.scan()).toBeTruthy();

        indexedRule = scanner.getRule();
        expect(indexedRule).toBeTruthy();
        expect(indexedRule && indexedRule.index).toBe(28);

        rule = indexedRule && indexedRule.rule;
        expect(rule).toBeTruthy();
        expect(
            getRuleSourceIndex(rule!.getIndex(), processed.sourceMap),
        ).toEqual(
            getRawRuleIndex(filterList, '##banner'),
        );
        expect(rule!.getFilterListId()).toEqual(1);

        expect(scanner.scan()).toBeFalsy();
        expect(scanner.scan()).toBeFalsy();
    });
});

describe('TestRuleScannerOfFileReader', () => {
    it('works if scanner is fine with file reader', async () => {
        // If we run the tests from the Vitest workspace, we need to set the correct path
        // See https://github.com/vitest-dev/vitest/issues/5277
        const hostsPath = path.join(__dirname, '../../resources/hosts');
        const content = await readFile(hostsPath, 'utf-8');
        const processed = FilterListPreprocessor.preprocess(content, true);
        const reader = new BufferReader(new InputByteBuffer(processed.filterList));

        const scanner = new RuleScanner(reader, 1, {
            scannerType: ScannerType.All, ignoreCosmetic: true,
        });

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

describe('Rule Scanner Flags', () => {
    // eslint-disable-next-line max-len
    const filterList = '||one.org\nexample.org#%#window.__gaq=undefined;\n||example.org^$removeheader=header-name\n||two.org';
    const processed = FilterListPreprocessor.preprocess(filterList);

    it('works if scanner respects ignoreJS flag', () => {
        const reader = new BufferReader(new InputByteBuffer(processed.filterList));
        const scanner = new RuleScanner(reader, 1, {
            scannerType: ScannerType.All,
            ignoreCosmetic: true,
            ignoreJS: true,
            ignoreUnsafe: false,
        });

        expect(scanner.getRule()).toBeFalsy();
        expect(scanner.scan()).toBeTruthy();

        let indexedRule = scanner.getRule();
        expect(indexedRule!.index).toBe(4);
        expect(
            getRuleSourceIndex(indexedRule!.rule!.getIndex(), processed.sourceMap),
        ).toEqual(
            getRawRuleIndex(filterList, '||one.org'),
        );

        expect(scanner.scan()).toBeTruthy();

        indexedRule = scanner.getRule();
        expect(indexedRule!.index).toBe(86);
        expect(
            getRuleSourceIndex(indexedRule!.rule!.getIndex(), processed.sourceMap),
        ).toEqual(
            getRawRuleIndex(filterList, '||example.org^$removeheader=header-name'),
        );

        expect(scanner.scan()).toBeTruthy();

        indexedRule = scanner.getRule();
        expect(indexedRule!.index).toBe(142);
        expect(
            getRuleSourceIndex(indexedRule!.rule!.getIndex(), processed.sourceMap),
        ).toEqual(
            getRawRuleIndex(filterList, '||two.org'),
        );

        expect(scanner.scan()).toBeFalsy();
        expect(scanner.scan()).toBeFalsy();
    });

    it('works if scanner respects ignoreUnsafe flag', () => {
        const reader = new BufferReader(new InputByteBuffer(processed.filterList));
        const scanner = new RuleScanner(reader, 1, {
            scannerType: ScannerType.All,
            ignoreCosmetic: false,
            ignoreJS: false,
            ignoreUnsafe: true,
        });

        expect(scanner.getRule()).toBeFalsy();
        expect(scanner.scan()).toBeTruthy();

        let indexedRule = scanner.getRule();
        expect(indexedRule!.index).toBe(4);
        expect(
            getRuleSourceIndex(indexedRule!.rule!.getIndex(), processed.sourceMap),
        ).toEqual(
            getRawRuleIndex(filterList, '||one.org'),
        );

        expect(scanner.scan()).toBeTruthy();

        indexedRule = scanner.getRule();
        expect(indexedRule!.index).toBe(24);
        expect(
            getRuleSourceIndex(indexedRule!.rule!.getIndex(), processed.sourceMap),
        ).toEqual(
            getRawRuleIndex(filterList, 'example.org#%#window.__gaq=undefined;'),
        );

        expect(scanner.scan()).toBeTruthy();

        indexedRule = scanner.getRule();
        expect(indexedRule!.index).toBe(142);
        expect(
            getRuleSourceIndex(indexedRule!.rule!.getIndex(), processed.sourceMap),
        ).toEqual(
            getRawRuleIndex(filterList, '||two.org'),
        );

        expect(scanner.scan()).toBeFalsy();
        expect(scanner.scan()).toBeFalsy();
    });
});
