import { describe, expect, it } from 'vitest';

import { RULE_INDEX_NONE } from '../../../src/constants';
import { type FilterListSourceMap } from '../../../src/filter';
import { getRuleSourceIndex, getRuleSourceText } from '../../../src/utils/source-map';

describe('Source Map utils', () => {
    describe('getRuleSourceText', () => {
        it('should extract rule text from single line source', () => {
            const source = '||example.com^$third-party';
            const result = getRuleSourceText(0, source);
            expect(result).toBe('||example.com^$third-party');
        });

        it('should extract rule text from multi-line source with LF', () => {
            const source = '||example.com^$third-party\n||test.com^$popup\n||ads.com^';
            const result = getRuleSourceText(0, source);
            expect(result).toBe('||example.com^$third-party');
        });

        it('should extract second rule from multi-line source', () => {
            const source = '||example.com^$third-party\n||test.com^$popup\n||ads.com^';
            const result = getRuleSourceText(27, source);
            expect(result).toBe('||test.com^$popup');
        });

        it('should extract last rule from multi-line source without trailing newline', () => {
            const source = '||example.com^$third-party\n||test.com^$popup\n||ads.com^';
            const result = getRuleSourceText(45, source);
            expect(result).toBe('||ads.com^');
        });

        it('should handle CRLF line breaks', () => {
            const source = '||example.com^$third-party\r\n||test.com^$popup';
            const result = getRuleSourceText(0, source);
            expect(result).toBe('||example.com^$third-party');
        });

        it('should handle CR line breaks', () => {
            const source = '||example.com^$third-party\r||test.com^$popup';
            const result = getRuleSourceText(0, source);
            expect(result).toBe('||example.com^$third-party');
        });

        it('should handle FF (form feed) line breaks', () => {
            const source = '||example.com^$third-party\f||test.com^$popup';
            const result = getRuleSourceText(0, source);
            expect(result).toBe('||example.com^$third-party');
        });

        it('should return null when line start index equals line end index', () => {
            const source = '||example.com^$third-party\n';
            const result = getRuleSourceText(26, source);
            expect(result).toBeNull();
        });

        it('should return null when line start index is greater than line end index', () => {
            const source = '||example.com^$third-party';
            const result = getRuleSourceText(30, source);
            expect(result).toBeNull();
        });

        it('should return null when line start index is at end of string', () => {
            const source = '||example.com^$third-party';
            const result = getRuleSourceText(source.length, source);
            expect(result).toBeNull();
        });

        it('should handle empty source string', () => {
            const source = '';
            const result = getRuleSourceText(0, source);
            expect(result).toBeNull();
        });

        it('should extract rule from middle of multi-line source with mixed line breaks', () => {
            const source = '||example.com^\n||test.com^\r\n||ads.com^\r||final.com^';
            const result = getRuleSourceText(15, source);
            expect(result).toBe('||test.com^');
        });

        it('should handle rule extraction at exact line boundary', () => {
            const source = 'rule1\nrule2\nrule3';
            const result = getRuleSourceText(6, source);
            expect(result).toBe('rule2');
        });
    });

    describe('getRuleSourceIndex', () => {
        it('should return correct source index for existing rule', () => {
            const sourceMap: FilterListSourceMap = {
                0: 0,
                1: 25,
                2: 50,
            };
            const result = getRuleSourceIndex(1, sourceMap);
            expect(result).toBe(25);
        });

        it('should return correct source index for first rule', () => {
            const sourceMap: FilterListSourceMap = {
                0: 0,
                1: 25,
                2: 50,
            };
            const result = getRuleSourceIndex(0, sourceMap);
            expect(result).toBe(0);
        });

        it('should return correct source index for last rule', () => {
            const sourceMap: FilterListSourceMap = {
                0: 0,
                1: 25,
                2: 50,
            };
            const result = getRuleSourceIndex(2, sourceMap);
            expect(result).toBe(50);
        });

        it('should return RULE_INDEX_NONE for non-existent rule index', () => {
            const sourceMap: FilterListSourceMap = {
                0: 0,
                1: 25,
                2: 50,
            };
            const result = getRuleSourceIndex(3, sourceMap);
            expect(result).toBe(RULE_INDEX_NONE);
        });

        it('should return RULE_INDEX_NONE for negative rule index', () => {
            const sourceMap: FilterListSourceMap = {
                0: 0,
                1: 25,
                2: 50,
            };
            const result = getRuleSourceIndex(-1, sourceMap);
            expect(result).toBe(RULE_INDEX_NONE);
        });

        it('should handle empty source map', () => {
            const sourceMap: FilterListSourceMap = {};
            const result = getRuleSourceIndex(0, sourceMap);
            expect(result).toBe(RULE_INDEX_NONE);
        });

        it('should handle source map with string keys correctly', () => {
            const sourceMap: FilterListSourceMap = {
                10: 100,
                20: 200,
                30: 300,
            };
            const result = getRuleSourceIndex(20, sourceMap);
            expect(result).toBe(200);
        });

        it('should return RULE_INDEX_NONE for rule index that exists as number but not as string key', () => {
            const sourceMap: FilterListSourceMap = {
                0: 0,
                1: 25,
            };
            // Rule index 2 doesn't exist in the map
            const result = getRuleSourceIndex(2, sourceMap);
            expect(result).toBe(RULE_INDEX_NONE);
        });

        it('should handle large rule indices', () => {
            const sourceMap: FilterListSourceMap = {
                1000: 50000,
                2000: 100000,
            };
            const result = getRuleSourceIndex(1000, sourceMap);
            expect(result).toBe(50000);
        });

        it('should handle zero source index', () => {
            const sourceMap: FilterListSourceMap = {
                5: 0,
                10: 25,
            };
            const result = getRuleSourceIndex(5, sourceMap);
            expect(result).toBe(0);
        });
    });
});
