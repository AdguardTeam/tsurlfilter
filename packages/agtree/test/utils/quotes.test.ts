import { describe, expect, test } from 'vitest';

import { QuoteType, QuoteUtils } from '../../src/utils/quotes';

describe('Quote utils', () => {
    describe('escapeUnescapedOccurrences', () => {
        test.each([
            {
                actual: '',
                expected: '',
                char: 'a',
            },
            {
                actual: 'b',
                expected: 'b',
                char: 'a',
            },
            {
                actual: 'a',
                expected: '\\a',
                char: 'a',
            },
            {
                actual: '\\a',
                expected: '\\a',
                char: 'a',
            },
            {
                actual: 'a\\a',
                expected: '\\a\\a',
                char: 'a',
            },
        ])('should escape \'$char\' in \'$actual\' as \'$expected\'', ({ actual, expected, char }) => {
            expect(QuoteUtils.escapeUnescapedOccurrences(actual, char)).toBe(expected);
        });
    });

    describe('unescapeSingleEscapedOccurrences', () => {
        test.each([
            {
                actual: '',
                expected: '',
                char: 'b',
            },
            {
                actual: 'aaa',
                expected: 'aaa',
                char: 'b',
            },
            {
                actual: 'aaa',
                expected: 'aaa',
                char: 'a',
            },
            {
                actual: '\\a',
                expected: 'a',
                char: 'a',
            },
            {
                actual: '\\\\a',
                expected: '\\\\a',
                char: 'a',
            },
            {
                actual: 'a\\aa',
                expected: 'aaa',
                char: 'a',
            },
        ])('should unescape \'$char\' in \'$actual\' as \'$expected\'', ({ actual, expected, char }) => {
            expect(QuoteUtils.unescapeSingleEscapedOccurrences(actual, char)).toBe(expected);
        });
    });

    describe('getStringQuoteType', () => {
        test.each([
            {
                actual: '',
                expected: QuoteType.None,
            },
            {
                actual: 'a',
                expected: QuoteType.None,
            },
            {
                actual: 'a\'',
                expected: QuoteType.None,
            },
            {
                actual: '\'a',
                expected: QuoteType.None,
            },
            {
                actual: 'a"',
                expected: QuoteType.None,
            },
            {
                actual: '"a',
                expected: QuoteType.None,
            },
            {
                actual: '"a\'',
                expected: QuoteType.None,
            },
            {
                actual: '\'a"',
                expected: QuoteType.None,
            },

            {
                actual: '\'a\'',
                expected: QuoteType.Single,
            },
            {
                actual: '"a"',
                expected: QuoteType.Double,
            },
            {
                actual: '\'a"b\'',
                expected: QuoteType.Single,
            },
            {
                actual: '"a\'b"',
                expected: QuoteType.Double,
            },
            {
                actual: '\'\\\'\'',
                expected: QuoteType.Single,
            },
            {
                actual: '"\\""',
                expected: QuoteType.Double,
            },

            // backtick quote
            {
                actual: '`a`',
                expected: QuoteType.Backtick,
            },
            {
                actual: '`a',
                expected: QuoteType.None,
            },
            {
                actual: 'a`',
                expected: QuoteType.None,
            },
            {
                actual: '`a\'',
                expected: QuoteType.None,
            },
            {
                actual: '\'a`',
                expected: QuoteType.None,
            },
            {
                actual: '`a"',
                expected: QuoteType.None,
            },
            {
                actual: '"a`',
                expected: QuoteType.None,
            },
            {
                actual: '`a\'',
                expected: QuoteType.None,
            },
            {
                actual: '\'a`',
                expected: QuoteType.None,
            },
            {
                actual: '`a"b`',
                expected: QuoteType.Backtick,
            },
            {
                actual: '`\\`\'`',
                expected: QuoteType.Backtick,
            },
            {
                actual: '`"\\`"`',
                expected: QuoteType.Backtick,
            },
            {
                actual: '“a”',
                expected: QuoteType.DoubleCurly,
            },
            {
                actual: '‘a’',
                expected: QuoteType.Curly,
            },
        ])('should detect \'$actual\' quotes as \'$expected\'', ({ actual, expected }) => {
            expect(QuoteUtils.getStringQuoteType(actual)).toBe(expected);
        });
    });

    describe('setStringQuoteType', () => {
        test.each([
            // Trivial cases
            {
                actual: '',
                expected: '',
                quote: QuoteType.None,
            },
            {
                actual: ' ',
                expected: ' ',
                quote: QuoteType.None,
            },
            {
                actual: 'a',
                expected: 'a',
                quote: QuoteType.None,
            },

            {
                actual: '"a"',
                expected: 'a',
                quote: QuoteType.None,
            },
            {
                actual: '\'a\'',
                expected: 'a',
                quote: QuoteType.None,
            },
            {
                actual: '`a`',
                expected: 'a',
                quote: QuoteType.None,
            },

            {
                actual: '',
                expected: '\'\'',
                quote: QuoteType.Single,
            },
            {
                actual: ' ',
                expected: '\' \'',
                quote: QuoteType.Single,
            },
            {
                actual: 'a',
                expected: '\'a\'',
                quote: QuoteType.Single,
            },

            {
                actual: '',
                expected: '""',
                quote: QuoteType.Double,
            },
            {
                actual: ' ',
                expected: '" "',
                quote: QuoteType.Double,
            },
            {
                actual: 'a',
                expected: '"a"',
                quote: QuoteType.Double,
            },

            {
                actual: '',
                expected: '``',
                quote: QuoteType.Backtick,
            },
            {
                actual: ' ',
                expected: '` `',
                quote: QuoteType.Backtick,
            },
            {
                actual: 'a',
                expected: '`a`',
                quote: QuoteType.Backtick,
            },

            // Leave unchanged if already quoted as expected
            {
                actual: '\'\'',
                expected: '\'\'',
                quote: QuoteType.Single,
            },
            {
                actual: '\' \'',
                expected: '\' \'',
                quote: QuoteType.Single,
            },
            {
                actual: '\'a\'',
                expected: '\'a\'',
                quote: QuoteType.Single,
            },

            {
                actual: '""',
                expected: '""',
                quote: QuoteType.Double,
            },
            {
                actual: '" "',
                expected: '" "',
                quote: QuoteType.Double,
            },
            {
                actual: '"a"',
                expected: '"a"',
                quote: QuoteType.Double,
            },
            {
                actual: '`a`',
                expected: '"a"',
                quote: QuoteType.Double,
            },

            {
                actual: '``',
                expected: '``',
                quote: QuoteType.Backtick,
            },
            {
                actual: '` `',
                expected: '` `',
                quote: QuoteType.Backtick,
            },
            {
                actual: '`a`',
                expected: '`a`',
                quote: QuoteType.Backtick,
            },

            // Change quotes if needed
            {
                actual: '\'\'',
                expected: '""',
                quote: QuoteType.Double,
            },
            {
                actual: '\' \'',
                expected: '" "',
                quote: QuoteType.Double,
            },
            {
                actual: '`a`',
                expected: '"a"',
                quote: QuoteType.Double,
            },
            {
                actual: '\'a\'',
                expected: '"a"',
                quote: QuoteType.Double,
            },

            {
                actual: '""',
                expected: '\'\'',
                quote: QuoteType.Single,
            },
            {
                actual: '" "',
                expected: '\' \'',
                quote: QuoteType.Single,
            },
            {
                actual: '"a"',
                expected: '\'a\'',
                quote: QuoteType.Single,
            },
            {
                actual: '`a`',
                expected: '\'a\'',
                quote: QuoteType.Single,
            },

            {
                actual: '\'\'',
                expected: '``',
                quote: QuoteType.Backtick,
            },
            {
                actual: '\' \'',
                expected: '` `',
                quote: QuoteType.Backtick,
            },
            {
                actual: '"a"',
                expected: '`a`',
                quote: QuoteType.Backtick,
            },
            {
                actual: '\'a\'',
                expected: '`a`',
                quote: QuoteType.Backtick,
            },

            // Escape quotes if needed
            {
                actual: '"a\'b"',
                expected: '\'a\\\'b\'',
                quote: QuoteType.Single,
            },
            {
                actual: '\'a"b\'',
                expected: '"a\\"b"',
                quote: QuoteType.Double,
            },
            {
                actual: '"aa`bb\'cc"',
                expected: '`aa\\`bb\'cc`',
                quote: QuoteType.Backtick,
            },
        ])('should apply \'$quote\' quotes to \'$actual\' as \'$expected\'', ({ actual, expected, quote }) => {
            expect(QuoteUtils.setStringQuoteType(actual, quote)).toBe(expected);
        });
    });

    const commonRemoveQuotesCases = [
        {
            actual: '"test"',
            expected: 'test',
        },
        {
            actual: "'test'",
            expected: 'test',
        },
        {
            actual: '"test',
            expected: '"test',
        },
        {
            actual: "'test",
            expected: "'test",
        },
        {
            actual: 'test"',
            expected: 'test"',
        },
        {
            actual: "test'",
            expected: "test'",
        },
        {
            actual: '"test\'',
            expected: '"test\'',
        },
        {
            actual: '\'test"',
            expected: '\'test"',
        },
        {
            actual: 'test',
            expected: 'test',
        },
        {
            actual: '',
            expected: '',
        },

        // do not remove quotes from single char strings
        {
            actual: '"',
            expected: '"',
        },
        {
            actual: "'",
            expected: "'",
        },
    ];

    describe('removeQuotes', () => {
        test.each(
            commonRemoveQuotesCases,
        )('removeQuotes should return $expected for $actual', ({ actual, expected }) => {
            expect(QuoteUtils.removeQuotes(actual)).toBe(expected);
        });
    });

    describe('removeQuotesAndUnescape', () => {
        test.each([
            ...commonRemoveQuotesCases,
            {
                actual: String.raw`'a\'b'`,
                expected: "a'b",
            },
            {
                actual: String.raw`"a\"b"`,
                expected: 'a"b',
            },
        ])('removeQuotes should return $expected for $actual', ({ actual, expected }) => {
            expect(QuoteUtils.removeQuotesAndUnescape(actual)).toBe(expected);
        });
    });

    describe('quoteAndJoinStrings', () => {
        test.each([
            {
                actual: [],
                expected: '',
            },
            {
                actual: ['a'],
                expected: "'a'",
            },
            {
                actual: ['a', 'b'],
                expected: "'a', 'b'",
            },
        ])('quoteAndJoinStrings should return $expected for $actual', ({ actual, expected }) => {
            expect(QuoteUtils.quoteAndJoinStrings(actual)).toBe(expected);
        });
    });
});
