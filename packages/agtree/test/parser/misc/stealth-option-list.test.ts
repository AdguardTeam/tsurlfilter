import { StealthOptionListParser } from '../../../src/parser/misc/stealth-option-list';
import { ListNodeType, ListItemNodeType } from '../../../src/parser/common';
import { EMPTY } from '../../../src/utils/constants';

describe('StealthOptionListParser', () => {
    // invalid inputs are tested in `list-helpers.test.ts`

    describe('parse should work as expected on valid input', () => {
        test.each([
            {
                actual: EMPTY,
                expected: {
                    type: ListNodeType.StealthOptionList,
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

            {
                actual: 'dpi',
                expected: {
                    type: ListNodeType.StealthOptionList,
                    loc: {
                        start: {
                            offset: 0,
                            line: 1,
                            column: 1,
                        },
                        end: {
                            offset: 3,
                            line: 1,
                            column: 4,
                        },
                    },
                    separator: '|',
                    children: [
                        {
                            type: ListItemNodeType.StealthOption,
                            loc: {
                                start: {
                                    offset: 0,
                                    line: 1,
                                    column: 1,
                                },
                                end: {
                                    offset: 3,
                                    line: 1,
                                    column: 4,
                                },
                            },
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
                            type: ListItemNodeType.StealthOption,
                            loc: {
                                start: {
                                    offset: 0,
                                    line: 1,
                                    column: 1,
                                },
                                end: {
                                    offset: 3,
                                    line: 1,
                                    column: 4,
                                },
                            },
                            value: 'dpi',
                            exception: false,
                        },
                        {
                            type: ListItemNodeType.StealthOption,
                            loc: {
                                start: {
                                    offset: 4,
                                    line: 1,
                                    column: 5,
                                },
                                end: {
                                    offset: 8,
                                    line: 1,
                                    column: 9,
                                },
                            },
                            value: 'push',
                            exception: false,
                        },
                        {
                            type: ListItemNodeType.StealthOption,
                            loc: {
                                start: {
                                    offset: 9,
                                    line: 1,
                                    column: 10,
                                },
                                end: {
                                    offset: 11,
                                    line: 1,
                                    column: 12,
                                },
                            },
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
                    loc: {
                        start: {
                            offset: 0,
                            line: 1,
                            column: 1,
                        },
                        end: {
                            offset: 13,
                            line: 1,
                            column: 14,
                        },
                    },
                    separator: '|',
                    children: [
                        {
                            type: ListItemNodeType.StealthOption,
                            loc: {
                                start: {
                                    offset: 1,
                                    line: 1,
                                    column: 2,
                                },
                                end: {
                                    offset: 4,
                                    line: 1,
                                    column: 5,
                                },
                            },
                            value: 'dpi',
                            exception: true,
                        },
                        {
                            type: ListItemNodeType.StealthOption,
                            loc: {
                                start: {
                                    offset: 5,
                                    line: 1,
                                    column: 6,
                                },
                                end: {
                                    offset: 9,
                                    line: 1,
                                    column: 10,
                                },
                            },
                            value: 'push',
                            exception: false,
                        },
                        {
                            type: ListItemNodeType.StealthOption,
                            loc: {
                                start: {
                                    offset: 11,
                                    line: 1,
                                    column: 12,
                                },
                                end: {
                                    offset: 13,
                                    line: 1,
                                    column: 14,
                                },
                            },
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
                    loc: {
                        start: {
                            offset: 0,
                            line: 1,
                            column: 1,
                        },
                        end: {
                            offset: 21,
                            line: 1,
                            column: 22,
                        },
                    },
                    separator: '|',
                    children: [
                        {
                            type: ListItemNodeType.StealthOption,
                            loc: {
                                start: {
                                    offset: 1,
                                    line: 1,
                                    column: 2,
                                },
                                end: {
                                    offset: 4,
                                    line: 1,
                                    column: 5,
                                },
                            },
                            value: 'dpi',
                            exception: true,
                        },
                        {
                            type: ListItemNodeType.StealthOption,
                            loc: {
                                start: {
                                    offset: 7,
                                    line: 1,
                                    column: 8,
                                },
                                end: {
                                    offset: 11,
                                    line: 1,
                                    column: 12,
                                },
                            },
                            value: 'push',
                            exception: false,
                        },
                        {
                            type: ListItemNodeType.StealthOption,
                            loc: {
                                start: {
                                    offset: 19,
                                    line: 1,
                                    column: 20,
                                },
                                end: {
                                    offset: 21,
                                    line: 1,
                                    column: 22,
                                },
                            },
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
