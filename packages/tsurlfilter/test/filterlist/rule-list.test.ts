import { RuleParser } from '@adguard/agtree';
import escapeStringRegexp from 'escape-string-regexp';
import { describe, expect, it } from 'vitest';

import { BufferRuleList } from '../../src/filterlist/buffer-rule-list';
import { FilterListPreprocessor, PREPROCESSOR_AGTREE_OPTIONS } from '../../src/filterlist/preprocessor';
import { LIST_ID_MAX_VALUE } from '../../src/filterlist/rule-list';
import { ScannerType } from '../../src/filterlist/scanner/scanner-type';
import { getRuleSourceIndex } from '../../src/filterlist/source-map';

describe('RuleScanner tests', () => {
    describe('BufferRuleList', () => {
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

        // TODO: Add array of raw rules, and re-use them in tests
        const rawFilterList = '||example.org\n! test\n##banner';
        const prepared = FilterListPreprocessor.preprocess(rawFilterList);
        const ruleList = new BufferRuleList(1, prepared.filterList, false, false, false, prepared.sourceMap);

        it('checks common properties', () => {
            expect(ruleList.getId()).toBe(1);
        });

        it('checks max list id', () => {
            expect(() => {
                new BufferRuleList(LIST_ID_MAX_VALUE, prepared.filterList);
            }).toThrowError();
        });

        const scanner = ruleList.newScanner(ScannerType.All);

        it('checks scanner', () => {
            expect(scanner).toBeTruthy();

            expect(scanner.scan()).toBeTruthy();

            let rule = scanner.getRule();
            expect(rule).toBeTruthy();
            expect(
                getRuleSourceIndex(rule!.rule.getIndex(), prepared.sourceMap),
            ).toEqual(
                getRawRuleIndex(prepared.rawFilterList, '||example.org'),
            );
            expect(rule!.rule.getFilterListId()).toBe(1);
            // index of the rule within the byte buffer
            // byte buffer starts from 4, because first 4 bytes are for schema version
            expect(rule!.index).toBe(4);

            expect(scanner.scan()).toBeTruthy();

            rule = scanner.getRule();
            expect(rule).toBeTruthy();
            expect(
                getRuleSourceIndex(rule!.rule.getIndex(), prepared.sourceMap),
            ).toEqual(
                getRawRuleIndex(prepared.rawFilterList, '##banner'),
            );
            expect(rule!.rule.getFilterListId()).toBe(1);
            expect(rule!.index).toBe(28);

            // Finish scanning
            expect(scanner.scan()).toBeFalsy();
        });

        it('retrieves rules by index', () => {
            let rule = ruleList.retrieveRuleNode(0);

            expect(rule).toBeTruthy();
            expect(rule!).toStrictEqual(RuleParser.parse('||example.org', PREPROCESSOR_AGTREE_OPTIONS));

            rule = ruleList.retrieveRuleNode(28);

            expect(rule).toBeTruthy();
            expect(rule!).toStrictEqual(RuleParser.parse('##banner', PREPROCESSOR_AGTREE_OPTIONS));

            rule = ruleList.retrieveRuleNode(-1);
            expect(rule).toBeNull();

            rule = ruleList.retrieveRuleNode(999);
            expect(rule).toBeNull();
        });

        ruleList.close();
    });
});
