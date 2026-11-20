import {
    describe,
    expect,
    test,
    vi,
} from 'vitest';

import { AdblockSyntaxError } from '../../../src/errors/adblock-syntax-error';
import { type CommaSeparator, ListItemNodeType, type PipeSeparator } from '../../../src/nodes';
import { LIST_PARSE_ERROR_PREFIX, ListItemsParser } from '../../../src/parser/misc/list-items-parser';
import { defaultParserOptions } from '../../../src/parser/options';
import { COMMA_DOMAIN_LIST_SEPARATOR, PIPE } from '../../../src/utils/constants';

/**
 * Checks that common function `parseListItems()` throws an error with the `expected` message.
 *
 * @param actual Raw modifier value.
 * @param expected Expected error message.
 * @param separator Separator character, defaults to `|`.
 */
const expectToThrowWhileParse = (
    actual: string,
    expected: string,
    separator: CommaSeparator | PipeSeparator = PIPE,
): void => {
    expect(() => ListItemsParser.parse(actual, defaultParserOptions, 0, separator)).toThrowError(expected);
};

describe('common parseListItems', () => {
    describe('works correctly on valid input', () => {
        test.each([
            {
                actual: 'example.com',
                expected: [
                    {
                        type: ListItemNodeType.Unknown,
                        start: 0,
                        end: 11,
                        value: 'example.com',
                        exception: false,
                    },
                ],
            },
            {
                actual: '~post|~put',
                expected: [
                    {
                        type: ListItemNodeType.Unknown,
                        start: 1,
                        end: 5,
                        value: 'post',
                        exception: true,
                    },
                    {
                        type: ListItemNodeType.Unknown,
                        start: 7,
                        end: 10,
                        value: 'put',
                        exception: true,
                    },
                ],
            },
            {
                actual: 'Example.exe|com.example.app|com.example.osx',
                expected: [
                    {
                        type: ListItemNodeType.Unknown,
                        start: 0,
                        end: 11,
                        value: 'Example.exe',
                        exception: false,
                    },
                    {
                        type: ListItemNodeType.Unknown,
                        start: 12,
                        end: 27,
                        value: 'com.example.app',
                        exception: false,
                    },
                    {
                        type: ListItemNodeType.Unknown,
                        start: 28,
                        end: 43,
                        value: 'com.example.osx',
                        exception: false,
                    },
                ],
            },
        ])('$actual', ({ actual, expected }) => {
            expect(ListItemsParser.parse(actual, defaultParserOptions, 0, PIPE)).toEqual(expected);
        });
    });

    describe('throw an error on invalid input', () => {
        describe('single value with no separator', () => {
            test.each([
                {
                    actual: '~',
                    expected: LIST_PARSE_ERROR_PREFIX.EMPTY_ITEM,
                },
                {
                    actual: '~~~',
                    expected: LIST_PARSE_ERROR_PREFIX.NO_MULTIPLE_NEGATION,
                },
                {
                    actual: ' ~ ~ ~ ',
                    expected: LIST_PARSE_ERROR_PREFIX.NO_WHITESPACE_AFTER_NEGATION,
                },
                {
                    actual: '~  Example.exe',
                    expected: LIST_PARSE_ERROR_PREFIX.NO_WHITESPACE_AFTER_NEGATION,
                },
            ])('$actual', ({ actual, expected }) => {
                expectToThrowWhileParse(actual, expected);
            });
        });

        describe('empty items', () => {
            test.each([
                {
                    actual: 'a,,b',
                    expected: LIST_PARSE_ERROR_PREFIX.EMPTY_ITEM,
                },
                // 1 extra space
                {
                    actual: 'a, ,b',
                    expected: LIST_PARSE_ERROR_PREFIX.EMPTY_ITEM,
                },
                // 2 extra spaces
                {
                    actual: 'a,  ,b',
                    expected: LIST_PARSE_ERROR_PREFIX.EMPTY_ITEM,
                },
                // extra spaces before and after separator
                {
                    actual: 'a ,, b',
                    expected: LIST_PARSE_ERROR_PREFIX.EMPTY_ITEM,
                },
                // extra spaces before and after separator and 1 extra space
                {
                    actual: 'a , , b',
                    expected: LIST_PARSE_ERROR_PREFIX.EMPTY_ITEM,
                },
                {
                    actual: 'a  ,  ,  b',
                    expected: LIST_PARSE_ERROR_PREFIX.EMPTY_ITEM,
                },
            ])('$actual', ({ actual, expected }) => {
                expectToThrowWhileParse(actual, expected, COMMA_DOMAIN_LIST_SEPARATOR);
            });
        });

        describe('value with separator', () => {
            // comma-separated
            test.each([
                {
                    actual: '~,~,~',
                    expected: LIST_PARSE_ERROR_PREFIX.NO_SEPARATOR_AFTER_NEGATION,
                },
                {
                    // https://github.com/AdguardTeam/AGLint/issues/143
                    actual: 'example.com,',
                    expected: LIST_PARSE_ERROR_PREFIX.NO_SEPARATOR_AT_THE_END,
                },
                {
                    actual: 'example.com  ,  ',
                    expected: LIST_PARSE_ERROR_PREFIX.NO_SEPARATOR_AT_THE_END,
                },
                {
                    actual: 'example.com,example.net,',
                    expected: LIST_PARSE_ERROR_PREFIX.NO_SEPARATOR_AT_THE_END,
                },
                {
                    actual: ',',
                    expected: LIST_PARSE_ERROR_PREFIX.NO_SEPARATOR_AT_THE_BEGINNING,
                },
                {
                    actual: 'example.com,,',
                    expected: LIST_PARSE_ERROR_PREFIX.NO_SEPARATOR_AT_THE_END,
                },
                {
                    actual: 'example.com , , ',
                    expected: LIST_PARSE_ERROR_PREFIX.NO_SEPARATOR_AT_THE_END,
                },
            ])('$actual', ({ actual, expected }) => {
                expectToThrowWhileParse(actual, expected, COMMA_DOMAIN_LIST_SEPARATOR);
            });

            // pipe-separated
            test.each([
                {
                    actual: '~|~|~',
                    expected: LIST_PARSE_ERROR_PREFIX.NO_SEPARATOR_AFTER_NEGATION,
                },
                {
                    actual: 'Example.exe|',
                    expected: LIST_PARSE_ERROR_PREFIX.NO_SEPARATOR_AT_THE_END,
                },
                {
                    actual: 'Example.exe  |  ',
                    expected: LIST_PARSE_ERROR_PREFIX.NO_SEPARATOR_AT_THE_END,
                },
                {
                    actual: '~get|~post|',
                    expected: LIST_PARSE_ERROR_PREFIX.NO_SEPARATOR_AT_THE_END,
                },
                {
                    actual: '|',
                    expected: LIST_PARSE_ERROR_PREFIX.NO_SEPARATOR_AT_THE_BEGINNING,
                },
                {
                    actual: 'head|get|',
                    expected: LIST_PARSE_ERROR_PREFIX.NO_SEPARATOR_AT_THE_END,
                },
                {
                    actual: 'Example.exe | | ',
                    expected: LIST_PARSE_ERROR_PREFIX.NO_SEPARATOR_AT_THE_END,
                },
                {
                    actual: '|dpi|ip',
                    expected: LIST_PARSE_ERROR_PREFIX.NO_SEPARATOR_AT_THE_BEGINNING,
                },
            ])('$actual', ({ actual, expected }) => {
                expectToThrowWhileParse(actual, expected, PIPE);
            });
        });
    });

    describe('regexp literals', () => {
        test.each([
            {
                actual: String.raw`/a\\/|example.org`,
                expected: [
                    {
                        type: ListItemNodeType.Unknown,
                        start: 0,
                        end: 5,
                        value: String.raw`/a\\/`,
                        exception: false,
                    },
                    {
                        type: ListItemNodeType.Unknown,
                        start: 6,
                        end: 17,
                        value: 'example.org',
                        exception: false,
                    },
                ],
            },
            {
                actual: String.raw`example.org|/a\/`,
                expected: [
                    {
                        type: ListItemNodeType.Unknown,
                        start: 0,
                        end: 11,
                        value: 'example.org',
                        exception: false,
                    },
                    {
                        type: ListItemNodeType.Unknown,
                        start: 12,
                        end: 16,
                        value: String.raw`/a\/`,
                        exception: false,
                    },
                ],
            },
            {
                actual: String.raw`example.org|/a\\/|example.com`,
                expected: [
                    {
                        type: ListItemNodeType.Unknown,
                        start: 0,
                        end: 11,
                        value: 'example.org',
                        exception: false,
                    },
                    {
                        type: ListItemNodeType.Unknown,
                        start: 12,
                        end: 17,
                        value: String.raw`/a\\/`,
                        exception: false,
                    },
                    {
                        type: ListItemNodeType.Unknown,
                        start: 18,
                        end: 29,
                        value: 'example.com',
                        exception: false,
                    },
                ],
            },
            {
                actual: String.raw`/examp[lp]e\.(com|org)/`,
                expected: [
                    {
                        type: ListItemNodeType.Unknown,
                        start: 0,
                        end: 23,
                        value: String.raw`/examp[lp]e\.(com|org)/`,
                        exception: false,
                    },
                ],
            },
            {
                actual: String.raw`/a\|b`,
                expected: [
                    {
                        type: ListItemNodeType.Unknown,
                        start: 0,
                        end: 5,
                        value: String.raw`/a\|b`,
                        exception: false,
                    },
                ],
            },
            {
                actual: String.raw`/a[|]b`,
                expected: [
                    {
                        type: ListItemNodeType.Unknown,
                        start: 0,
                        end: 6,
                        value: String.raw`/a[|]b`,
                        exception: false,
                    },
                ],
            },
            {
                actual: String.raw`/a(b|c)`,
                expected: [
                    {
                        type: ListItemNodeType.Unknown,
                        start: 0,
                        end: 7,
                        value: String.raw`/a(b|c)`,
                        exception: false,
                    },
                ],
            },
            {
                actual: String.raw`/a\\\|b`,
                expected: [
                    {
                        type: ListItemNodeType.Unknown,
                        start: 0,
                        end: 7,
                        value: String.raw`/a\\\|b`,
                        exception: false,
                    },
                ],
            },
            {
                actual: String.raw`/a(b|example.org`,
                expected: [
                    {
                        type: ListItemNodeType.Unknown,
                        start: 0,
                        end: 16,
                        value: String.raw`/a(b|example.org`,
                        exception: false,
                    },
                ],
            },
            {
                actual: String.raw`~/a\/|example.org|/b/`,
                expected: [
                    {
                        type: ListItemNodeType.Unknown,
                        start: 1,
                        end: 21,
                        value: String.raw`/a\/|example.org|/b/`,
                        exception: true,
                    },
                ],
            },
        ])('$actual', ({ actual, expected }) => {
            expect(ListItemsParser.parse(actual, defaultParserOptions, 0, PIPE)).toEqual(expected);
        });

        test.each([
            {
                actual: String.raw`~/a\/|example.org`,
                start: 1,
                end: 17,
            },
            {
                actual: String.raw`/a\/|example.org`,
                start: 0,
                end: 16,
            },
            {
                actual: String.raw`~/|example.org`,
                start: 1,
                end: 14,
            },
            {
                actual: String.raw`/a\|b|example.org`,
                start: 0,
                end: 17,
            },
            {
                actual: String.raw`/a[|]b|example.org`,
                start: 0,
                end: 18,
            },
            {
                actual: String.raw`/a\\|b`,
                start: 0,
                end: 6,
            },
            {
                actual: String.raw`/a(b|c)|example.org`,
                start: 0,
                end: 19,
            },
            {
                actual: String.raw`/a/x|example.org`,
                start: 0,
                end: 16,
            },
        ])('$actual should throw on an unclosed regexp literal', ({ actual, start, end }) => {
            const fn = vi.fn(() => ListItemsParser.parse(actual, defaultParserOptions, 0, PIPE));

            expect(fn).toThrowError(LIST_PARSE_ERROR_PREFIX.UNCLOSED_REGEXP_LITERAL);

            const error = fn.mock.results[0].value;
            expect(error).toBeInstanceOf(AdblockSyntaxError);
            expect(error).toMatchObject({ start, end });
        });
    });

    describe('parser options should work as expected', () => {
        test.each([
            {
                actual: 'example.com',
                expected: [
                    {
                        type: ListItemNodeType.Unknown,
                        value: 'example.com',
                        exception: false,
                    },
                ],
            },
        ])('isLocIncluded should work for $actual', ({ actual, expected }) => {
            expect(
                ListItemsParser.parse(actual, { ...defaultParserOptions, isLocIncluded: false }, 0, PIPE),
            ).toEqual(expected);
        });
    });
});
