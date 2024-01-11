import { type CommaSeparator, type PipeSeparator } from '../../../src/parser/common';
import { LIST_PARSE_ERROR_PREFIX, parseListItems } from '../../../src/parser/misc/list-helpers';
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
    expect(() => parseListItems(actual, { separator })).toThrowError(expected);
};

describe('common parseListItems', () => {
    describe('works correctly on valid input', () => {
        test.each([
            {
                actual: 'example.com',
                expected: [
                    {
                        loc: {
                            start: {
                                offset: 0,
                                line: 1,
                                column: 1,
                            },
                            end: {
                                offset: 11,
                                line: 1,
                                column: 12,
                            },
                        },
                        value: 'example.com',
                        exception: false,
                    },
                ],
            },
            {
                actual: '~post|~put',
                expected: [
                    {
                        loc: {
                            start: {
                                offset: 1,
                                line: 1,
                                column: 2,
                            },
                            end: {
                                offset: 5,
                                line: 1,
                                column: 6,
                            },
                        },
                        value: 'post',
                        exception: true,
                    },
                    {
                        loc: {
                            start: {
                                offset: 7,
                                line: 1,
                                column: 8,
                            },
                            end: {
                                offset: 10,
                                line: 1,
                                column: 11,
                            },
                        },
                        value: 'put',
                        exception: true,
                    },
                ],
            },
            {
                actual: 'Example.exe|com.example.app|com.example.osx',
                expected: [
                    {
                        loc: {
                            start: {
                                offset: 0,
                                line: 1,
                                column: 1,
                            },
                            end: {
                                offset: 11,
                                line: 1,
                                column: 12,
                            },
                        },
                        value: 'Example.exe',
                        exception: false,
                    },
                    {
                        loc: {
                            start: {
                                offset: 12,
                                line: 1,
                                column: 13,
                            },
                            end: {
                                offset: 27,
                                line: 1,
                                column: 28,
                            },
                        },
                        value: 'com.example.app',
                        exception: false,
                    },
                    {
                        loc: {
                            start: {
                                offset: 28,
                                line: 1,
                                column: 29,
                            },
                            end: {
                                offset: 43,
                                line: 1,
                                column: 44,
                            },
                        },
                        value: 'com.example.osx',
                        exception: false,
                    },
                ],
            },
        ])('$actual', ({ actual, expected }) => {
            expect(parseListItems(actual, { separator: PIPE })).toEqual(expected);
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
                        value: 'example.com',
                        exception: false,
                    },
                ],
            },
        ])('isLocIncluded should work for $actual', ({ actual, expected }) => {
            expect(parseListItems(actual, { separator: PIPE, isLocIncluded: false })).toEqual(expected);
        });
    });
});
