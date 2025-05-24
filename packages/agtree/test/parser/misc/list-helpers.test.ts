import { describe, test, expect } from 'vitest';

import { ListItemNodeType, type CommaSeparator, type PipeSeparator } from '../../../src/nodes/index.js';
import { defaultParserOptions } from '../../../src/parser/options.js';
import { COMMA_DOMAIN_LIST_SEPARATOR, PIPE } from '../../../src/utils/constants.js';
import { LIST_PARSE_ERROR_PREFIX, ListItemsParser } from '../../../src/parser/misc/list-items-parser.js';

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
