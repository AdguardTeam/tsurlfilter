import { describe, test, expect } from 'vitest';

import { AppListParser } from '../../../src/parser/misc/app-list-parser.js';
import { ListNodeType, ListItemNodeType } from '../../../src/nodes/index.js';
import { EMPTY } from '../../../src/utils/constants.js';

describe('AppListParser', () => {
    // invalid inputs are tested in `list-helpers.test.ts`

    describe('parse should work as expected on valid input', () => {
        test.each([
            // Empty
            {
                actual: EMPTY,
                expected: {
                    type: ListNodeType.AppList,
                    start: 0,
                    end: 0,
                    separator: '|',
                    children: [],
                },
            },

            // Single app
            {
                actual: 'Example.exe',
                expected: {
                    type: ListNodeType.AppList,
                    start: 0,
                    end: 11,
                    separator: '|',
                    children: [
                        {
                            type: ListItemNodeType.App,
                            start: 0,
                            end: 11,
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
                    start: 0,
                    end: 27,
                    separator: '|',
                    children: [
                        {
                            type: ListItemNodeType.App,
                            start: 0,
                            end: 11,
                            value: 'Example.exe',
                            exception: false,
                        },
                        {
                            type: ListItemNodeType.App,
                            start: 12,
                            end: 27,
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
                    start: 0,
                    end: 43,
                    separator: '|',
                    children: [
                        {
                            type: ListItemNodeType.App,
                            start: 0,
                            end: 11,
                            value: 'Example.exe',
                            exception: false,
                        },
                        {
                            type: ListItemNodeType.App,
                            start: 12,
                            end: 27,
                            value: 'com.example.app',
                            exception: false,
                        },
                        {
                            type: ListItemNodeType.App,
                            start: 28,
                            end: 43,
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
                    start: 0,
                    end: 12,
                    separator: '|',
                    children: [
                        {
                            type: ListItemNodeType.App,
                            start: 1,
                            end: 12,
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
                    start: 0,
                    end: 29,
                    separator: '|',
                    children: [
                        {
                            type: ListItemNodeType.App,
                            start: 1,
                            end: 12,
                            value: 'Example.exe',
                            exception: true,
                        },
                        {
                            type: ListItemNodeType.App,
                            start: 14,
                            end: 29,
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
                    start: 0,
                    end: 46,
                    separator: '|',
                    children: [
                        {
                            type: ListItemNodeType.App,
                            start: 1,
                            end: 12,
                            value: 'Example.exe',
                            exception: true,
                        },
                        {
                            type: ListItemNodeType.App,
                            start: 14,
                            end: 29,
                            value: 'com.example.app',
                            exception: true,
                        },
                        {
                            type: ListItemNodeType.App,
                            start: 31,
                            end: 46,
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
                    start: 0,
                    end: 45,
                    separator: '|',
                    children: [
                        {
                            type: ListItemNodeType.App,
                            start: 1,
                            end: 12,
                            value: 'Example.exe',
                            exception: true,
                        },
                        {
                            type: ListItemNodeType.App,
                            start: 13,
                            end: 28,
                            value: 'com.example.app',
                            exception: false,
                        },
                        {
                            type: ListItemNodeType.App,
                            start: 30,
                            end: 45,
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
                    start: 0,
                    end: 84,
                    separator: '|',
                    children: [
                        {
                            type: ListItemNodeType.App,
                            start: 1,
                            end: 12,
                            value: 'Example.exe',
                            exception: true,
                        },
                        {
                            type: ListItemNodeType.App,
                            start: 15,
                            end: 30,
                            value: 'com.example.app',
                            exception: false,
                        },
                        {
                            type: ListItemNodeType.App,
                            start: 38,
                            end: 58,
                            value: 'com.test.example.app',
                            exception: false,
                        },
                        {
                            type: ListItemNodeType.App,
                            start: 69,
                            end: 84,
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
