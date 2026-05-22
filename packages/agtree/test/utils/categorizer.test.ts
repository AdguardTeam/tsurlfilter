import { describe, expect, test } from 'vitest';

import { RuleCategory } from '../../src/nodes';
import { RuleCategorizer } from '../../src/utils/categorizer';

describe('RuleCategorizer', () => {
    describe('categorize', () => {
        const categorizer = new RuleCategorizer();

        // Empty
        test.each([
            { input: '', expected: RuleCategory.Empty },
            { input: '   ', expected: RuleCategory.Empty },
            { input: '\t', expected: RuleCategory.Empty },
        ])('should return Empty for "$input"', ({ input, expected }) => {
            expect(categorizer.categorize(input)).toBe(expected);
        });

        // Comments
        test.each([
            { input: '! This is a comment', expected: RuleCategory.Comment },
            { input: '!Homepage: https://example.com', expected: RuleCategory.Comment },
            { input: '# host comment', expected: RuleCategory.Comment },
            { input: '[Adblock Plus 2.0]', expected: RuleCategory.Comment },
            { input: '[AdGuard]', expected: RuleCategory.Comment },
        ])('should return Comment for "$input"', ({ input, expected }) => {
            expect(categorizer.categorize(input)).toBe(expected);
        });

        // Cosmetic
        test.each([
            { input: 'example.com##.ad-banner', expected: RuleCategory.Cosmetic },
            { input: 'example.com#@#.ad-banner', expected: RuleCategory.Cosmetic },
            { input: 'example.com#?#.ad:has(.inner)', expected: RuleCategory.Cosmetic },
            { input: 'example.com#$#body { padding: 0; }', expected: RuleCategory.Cosmetic },
            { input: "example.com#%#//scriptlet('foo')", expected: RuleCategory.Cosmetic },
            { input: 'example.com##+js(foo)', expected: RuleCategory.Cosmetic },
            { input: '##.ad-banner', expected: RuleCategory.Cosmetic },
        ])('should return Cosmetic for "$input"', ({ input, expected }) => {
            expect(categorizer.categorize(input)).toBe(expected);
        });

        // Network
        test.each([
            { input: '||example.com^', expected: RuleCategory.Network },
            { input: '@@||example.com^', expected: RuleCategory.Network },
            { input: '/ads.js^$script', expected: RuleCategory.Network },
            { input: '||example.com^$third-party', expected: RuleCategory.Network },
            { input: 'example.com', expected: RuleCategory.Network },
        ])('should return Network for "$input"', ({ input, expected }) => {
            expect(categorizer.categorize(input)).toBe(expected);
        });

        // Invalid/malformed rules — should not throw
        test.each([
            { input: '||example.com^$badmod=[' },
            { input: '###' },
            { input: '\x00\x01\x02' },
        ])('should not throw for malformed "$input"', ({ input }) => {
            expect(() => categorizer.categorize(input)).not.toThrow();
        });
    });
});
