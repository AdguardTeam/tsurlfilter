import escapeStringRegexp from 'escape-string-regexp';
import { describe, expect, it } from 'vitest';

import { LIST_ID_MAX_VALUE } from '../../src/filterlist/rule-list';
import { ScannerType } from '../../src/filterlist/scanner/scanner-type';
import { StringRuleList } from '../../src/filterlist/string-rule-list';

describe('RuleScanner tests', () => {
    describe('StringRuleList', () => {
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
        const rules = [
            '||example.org',
            '! test',
            '##banner',
        ];
        const text = rules.join('\n');
        const list = new StringRuleList(1, text, false, false, false);

        it('checks common properties', () => {
            expect(list.getId()).toBe(1);
        });

        it('checks max list id', () => {
            expect(() => {
                new StringRuleList(LIST_ID_MAX_VALUE, text, false, false, false);
            }).toThrowError();
        });

        const scanner = list.newScanner(ScannerType.All);

        it('checks scanner', () => {
            expect(scanner).toBeTruthy();

            expect(scanner.scan()).toBeTruthy();

            let ruleParts = scanner.getRuleParts();
            expect(ruleParts).toBeTruthy();
            expect(ruleParts!.index).toEqual(getRawRuleIndex(text, '||example.org'));
            expect(ruleParts!.listId).toBe(1);

            expect(scanner.scan()).toBeTruthy();

            ruleParts = scanner.getRuleParts();
            expect(ruleParts).toBeTruthy();
            expect(ruleParts!.index).toEqual(getRawRuleIndex(text, '##banner'));
            expect(ruleParts!.listId).toBe(1);

            // Finish scanning
            expect(scanner.scan()).toBeFalsy();
        });

        it('retrieves rules by index', () => {
            let rule = list.retrieveRuleText(text.indexOf('||example.org'));

            expect(rule).toBeTruthy();
            expect(rule).toBe('||example.org');

            rule = list.retrieveRuleText(text.indexOf('##banner'));

            expect(rule).toBeTruthy();
            expect(rule).toBe('##banner');

            rule = list.retrieveRuleText(-1);
            expect(rule).toBeNull();

            rule = list.retrieveRuleText(999);
            expect(rule).toBeNull();
        });

        list.close();
    });
});
