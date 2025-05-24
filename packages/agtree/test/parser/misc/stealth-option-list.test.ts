import { describe, test, expect } from 'vitest';

import { StealthOptionListParser } from '../../../src/parser/misc/stealth-option-list-parser.js';
import { ListNodeType, ListItemNodeType } from '../../../src/nodes/index.js';
import { EMPTY } from '../../../src/utils/constants.js';

describe('StealthOptionListParser', () => {
    // invalid inputs are tested in `list-helpers.test.ts`

    describe('parse should work as expected on valid input', () => {
        test.each([
            {
                actual: EMPTY,
                expected: {
                    type: ListNodeType.StealthOptionList,
                    start: 0,
                    end: 0,
                    separator: '|',
                    children: [],
                },
            },

            {
                actual: 'dpi',
                expected: {
                    type: ListNodeType.StealthOptionList,
                    start: 0,
                    end: 3,
                    separator: '|',
                    children: [
                        {
                            type: ListItemNodeType.StealthOption,
                            start: 0,
                            end: 3,
                            value: 'dpi',
                            exception: false,
                        },
                    ],
                },
            },

            {
                actual: 'dpi|push|ip',
                expected: {
                    type: ListNodeType.StealthOptionList,
                    start: 0,
                    end: 11,
                    separator: '|',
                    children: [
                        {
                            type: ListItemNodeType.StealthOption,
                            start: 0,
                            end: 3,
                            value: 'dpi',
                            exception: false,
                        },
                        {
                            type: ListItemNodeType.StealthOption,
                            start: 4,
                            end: 8,
                            value: 'push',
                            exception: false,
                        },
                        {
                            type: ListItemNodeType.StealthOption,
                            start: 9,
                            end: 11,
                            value: 'ip',
                            exception: false,
                        },
                    ],
                },
            },

            {
                actual: '~dpi|push|~ip',
                expected: {
                    type: ListNodeType.StealthOptionList,
                    start: 0,
                    end: 13,
                    separator: '|',
                    children: [
                        {
                            type: ListItemNodeType.StealthOption,
                            start: 1,
                            end: 4,
                            value: 'dpi',
                            exception: true,
                        },
                        {
                            type: ListItemNodeType.StealthOption,
                            start: 5,
                            end: 9,
                            value: 'push',
                            exception: false,
                        },
                        {
                            type: ListItemNodeType.StealthOption,
                            start: 11,
                            end: 13,
                            value: 'ip',
                            exception: true,
                        },
                    ],
                },
            },

            {
                actual: '~dpi|  push    |   ip',
                expected: {
                    type: ListNodeType.StealthOptionList,
                    start: 0,
                    end: 21,
                    separator: '|',
                    children: [
                        {
                            type: ListItemNodeType.StealthOption,
                            start: 1,
                            end: 4,
                            value: 'dpi',
                            exception: true,
                        },
                        {
                            type: ListItemNodeType.StealthOption,
                            start: 7,
                            end: 11,
                            value: 'push',
                            exception: false,
                        },
                        {
                            type: ListItemNodeType.StealthOption,
                            start: 19,
                            end: 21,
                            value: 'ip',
                            exception: false,
                        },
                    ],
                },
            },
        ])('$actual', ({ actual, expected }) => {
            expect(StealthOptionListParser.parse(actual)).toEqual(expected);
        });
    });

    describe('parser options should work as expected', () => {
        test.each([
            {
                actual: 'dpi|push|ip',
                expected: {
                    type: ListNodeType.StealthOptionList,
                    separator: '|',
                    children: [
                        {
                            type: ListItemNodeType.StealthOption,
                            value: 'dpi',
                            exception: false,
                        },
                        {
                            type: ListItemNodeType.StealthOption,
                            value: 'push',
                            exception: false,
                        },
                        {
                            type: ListItemNodeType.StealthOption,
                            value: 'ip',
                            exception: false,
                        },
                    ],
                },
            },
        ])('isLocIncluded should work for $actual', ({ actual, expected }) => {
            expect(StealthOptionListParser.parse(actual, { isLocIncluded: false })).toEqual(expected);
        });
    });
});
