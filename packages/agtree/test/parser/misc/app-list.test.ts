import { AppListParser } from '../../../src/parser/misc/app-list';
import { ListNodeType, ListItemNodeType } from '../../../src/parser/common';
import { EMPTY } from '../../../src/utils/constants';

describe('AppListParser', () => {
    // invalid inputs are tested in `list-helpers.test.ts`

    describe('parse should work as expected on valid input', () => {
        test.each([
            // Empty
            {
                actual: EMPTY,
                expected: {
                    type: ListNodeType.AppList,
                    loc: {
                        start: {
                            offset: 0,
                            line: 1,
                            column: 1,
                        },
                        end: {
                            offset: 0,
                            line: 1,
                            column: 1,
                        },
                    },
                    separator: '|',
                    children: [],
                },
            },

            // Single app
            {
                actual: 'Example.exe',
                expected: {
                    type: ListNodeType.AppList,
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
                    separator: '|',
                    children: [
                        {
                            type: ListItemNodeType.App,
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
                    ],
                },
            },

            // Multiple apps
            {
                actual: 'Example.exe|com.example.app',
                expected: {
                    type: ListNodeType.AppList,
                    loc: {
                        start: {
                            offset: 0,
                            line: 1,
                            column: 1,
                        },
                        end: {
                            offset: 27,
                            line: 1,
                            column: 28,
                        },
                    },
                    separator: '|',
                    children: [
                        {
                            type: ListItemNodeType.App,
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
                            type: ListItemNodeType.App,
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
                    ],
                },
            },

            {
                actual: 'Example.exe|com.example.app|com.example.osx',
                expected: {
                    type: ListNodeType.AppList,
                    loc: {
                        start: {
                            offset: 0,
                            line: 1,
                            column: 1,
                        },
                        end: {
                            offset: 43,
                            line: 1,
                            column: 44,
                        },
                    },
                    separator: '|',
                    children: [
                        {
                            type: ListItemNodeType.App,
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
                            type: ListItemNodeType.App,
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
                            type: ListItemNodeType.App,
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
            },

            // Exception - single app
            {
                actual: '~Example.exe',
                expected: {
                    type: ListNodeType.AppList,
                    loc: {
                        start: {
                            offset: 0,
                            line: 1,
                            column: 1,
                        },
                        end: {
                            offset: 12,
                            line: 1,
                            column: 13,
                        },
                    },
                    separator: '|',
                    children: [
                        {
                            type: ListItemNodeType.App,
                            loc: {
                                start: {
                                    offset: 1,
                                    line: 1,
                                    column: 2,
                                },
                                end: {
                                    offset: 12,
                                    line: 1,
                                    column: 13,
                                },
                            },
                            value: 'Example.exe',
                            exception: true,
                        },
                    ],
                },
            },

            // Exception - multiple apps
            {
                actual: '~Example.exe|~com.example.app',
                expected: {
                    type: ListNodeType.AppList,
                    loc: {
                        start: {
                            offset: 0,
                            line: 1,
                            column: 1,
                        },
                        end: {
                            offset: 29,
                            line: 1,
                            column: 30,
                        },
                    },
                    separator: '|',
                    children: [
                        {
                            type: ListItemNodeType.App,
                            loc: {
                                start: {
                                    offset: 1,
                                    line: 1,
                                    column: 2,
                                },
                                end: {
                                    offset: 12,
                                    line: 1,
                                    column: 13,
                                },
                            },
                            value: 'Example.exe',
                            exception: true,
                        },
                        {
                            type: ListItemNodeType.App,
                            loc: {
                                start: {
                                    offset: 14,
                                    line: 1,
                                    column: 15,
                                },
                                end: {
                                    offset: 29,
                                    line: 1,
                                    column: 30,
                                },
                            },
                            value: 'com.example.app',
                            exception: true,
                        },
                    ],
                },
            },

            {
                actual: '~Example.exe|~com.example.app|~com.example.osx',
                expected: {
                    type: ListNodeType.AppList,
                    loc: {
                        start: {
                            offset: 0,
                            line: 1,
                            column: 1,
                        },
                        end: {
                            offset: 46,
                            line: 1,
                            column: 47,
                        },
                    },
                    separator: '|',
                    children: [
                        {
                            type: ListItemNodeType.App,
                            loc: {
                                start: {
                                    offset: 1,
                                    line: 1,
                                    column: 2,
                                },
                                end: {
                                    offset: 12,
                                    line: 1,
                                    column: 13,
                                },
                            },
                            value: 'Example.exe',
                            exception: true,
                        },
                        {
                            type: ListItemNodeType.App,
                            loc: {
                                start: {
                                    offset: 14,
                                    line: 1,
                                    column: 15,
                                },
                                end: {
                                    offset: 29,
                                    line: 1,
                                    column: 30,
                                },
                            },
                            value: 'com.example.app',
                            exception: true,
                        },
                        {
                            type: ListItemNodeType.App,
                            loc: {
                                start: {
                                    offset: 31,
                                    line: 1,
                                    column: 32,
                                },
                                end: {
                                    offset: 46,
                                    line: 1,
                                    column: 47,
                                },
                            },
                            value: 'com.example.osx',
                            exception: true,
                        },
                    ],
                },
            },

            // Mixed - multiple apps
            {
                actual: '~Example.exe|com.example.app|~com.example.osx',
                expected: {
                    type: ListNodeType.AppList,
                    loc: {
                        start: {
                            offset: 0,
                            line: 1,
                            column: 1,
                        },
                        end: {
                            offset: 45,
                            line: 1,
                            column: 46,
                        },
                    },
                    separator: '|',
                    children: [
                        {
                            type: ListItemNodeType.App,
                            loc: {
                                start: {
                                    offset: 1,
                                    line: 1,
                                    column: 2,
                                },
                                end: {
                                    offset: 12,
                                    line: 1,
                                    column: 13,
                                },
                            },
                            value: 'Example.exe',
                            exception: true,
                        },
                        {
                            type: ListItemNodeType.App,
                            loc: {
                                start: {
                                    offset: 13,
                                    line: 1,
                                    column: 14,
                                },
                                end: {
                                    offset: 28,
                                    line: 1,
                                    column: 29,
                                },
                            },
                            value: 'com.example.app',
                            exception: false,
                        },
                        {
                            type: ListItemNodeType.App,
                            loc: {
                                start: {
                                    offset: 30,
                                    line: 1,
                                    column: 31,
                                },
                                end: {
                                    offset: 45,
                                    line: 1,
                                    column: 46,
                                },
                            },
                            value: 'com.example.osx',
                            exception: true,
                        },
                    ],
                },
            },

            // Mixed - trim spaces
            {
                actual: '~Example.exe|  com.example.app    |   com.test.example.app |        ~com.example.osx',
                expected: {
                    type: ListNodeType.AppList,
                    loc: {
                        start: {
                            offset: 0,
                            line: 1,
                            column: 1,
                        },
                        end: {
                            offset: 84,
                            line: 1,
                            column: 85,
                        },
                    },
                    separator: '|',
                    children: [
                        {
                            type: ListItemNodeType.App,
                            loc: {
                                start: {
                                    offset: 1,
                                    line: 1,
                                    column: 2,
                                },
                                end: {
                                    offset: 12,
                                    line: 1,
                                    column: 13,
                                },
                            },
                            value: 'Example.exe',
                            exception: true,
                        },
                        {
                            type: ListItemNodeType.App,
                            loc: {
                                start: {
                                    offset: 15,
                                    line: 1,
                                    column: 16,
                                },
                                end: {
                                    offset: 30,
                                    line: 1,
                                    column: 31,
                                },
                            },
                            value: 'com.example.app',
                            exception: false,
                        },
                        {
                            type: ListItemNodeType.App,
                            loc: {
                                start: {
                                    offset: 38,
                                    line: 1,
                                    column: 39,
                                },
                                end: {
                                    offset: 58,
                                    line: 1,
                                    column: 59,
                                },
                            },
                            value: 'com.test.example.app',
                            exception: false,
                        },
                        {
                            type: ListItemNodeType.App,
                            loc: {
                                start: {
                                    offset: 69,
                                    line: 1,
                                    column: 70,
                                },
                                end: {
                                    offset: 84,
                                    line: 1,
                                    column: 85,
                                },
                            },
                            value: 'com.example.osx',
                            exception: true,
                        },
                    ],
                },
            },
        ])('$actual', ({ actual, expected }) => {
            expect(AppListParser.parse(actual)).toEqual(expected);
        });
    });

    describe('parser options should work as expected', () => {
        test.each([
            {
                actual: 'Example.exe',
                expected: {
                    type: ListNodeType.AppList,
                    separator: '|',
                    children: [
                        {
                            type: ListItemNodeType.App,
                            value: 'Example.exe',
                            exception: false,
                        },
                    ],
                },
            },
        ])('isLocIncluded should work for $actual', ({ actual, expected }) => {
            expect(AppListParser.parse(actual, { isLocIncluded: false })).toEqual(expected);
        });
    });
});
