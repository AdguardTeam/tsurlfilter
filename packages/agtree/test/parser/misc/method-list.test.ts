import { MethodListParser } from '../../../src/parser/misc/method-list';
import { ListNodeType, ListItemNodeType } from '../../../src/parser/common';
import { EMPTY } from '../../../src/utils/constants';

describe('MethodListParser', () => {
    // invalid inputs are tested in `list-helpers.test.ts`

    describe('parse should work as expected on valid input', () => {
        test.each([
            {
                actual: EMPTY,
                expected: {
                    type: ListNodeType.MethodList,
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
                actual: 'get',
                expected: {
                    type: ListNodeType.MethodList,
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
                            type: ListItemNodeType.Method,
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
                            value: 'get',
                            exception: false,
                        },
                    ],
                },
            },

            {
                actual: 'get|post|put',
                expected: {
                    type: ListNodeType.MethodList,
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
                            type: ListItemNodeType.Method,
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
                            value: 'get',
                            exception: false,
                        },
                        {
                            type: ListItemNodeType.Method,
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
                            value: 'post',
                            exception: false,
                        },
                        {
                            type: ListItemNodeType.Method,
                            loc: {
                                start: {
                                    offset: 9,
                                    line: 1,
                                    column: 10,
                                },
                                end: {
                                    offset: 12,
                                    line: 1,
                                    column: 13,
                                },
                            },
                            value: 'put',
                            exception: false,
                        },
                    ],
                },
            },

            {
                actual: '~get',
                expected: {
                    type: ListNodeType.MethodList,
                    loc: {
                        start: {
                            offset: 0,
                            line: 1,
                            column: 1,
                        },
                        end: {
                            offset: 4,
                            line: 1,
                            column: 5,
                        },
                    },
                    separator: '|',
                    children: [
                        {
                            type: ListItemNodeType.Method,
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
                            value: 'get',
                            exception: true,
                        },
                    ],
                },
            },

            {
                actual: '~post|~put',
                expected: {
                    type: ListNodeType.MethodList,
                    loc: {
                        start: {
                            offset: 0,
                            line: 1,
                            column: 1,
                        },
                        end: {
                            offset: 10,
                            line: 1,
                            column: 11,
                        },
                    },
                    separator: '|',
                    children: [
                        {
                            type: ListItemNodeType.Method,
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
                            type: ListItemNodeType.Method,
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
            },

            {
                actual: '~put|~get|~head',
                expected: {
                    type: ListNodeType.MethodList,
                    loc: {
                        start: {
                            offset: 0,
                            line: 1,
                            column: 1,
                        },
                        end: {
                            offset: 15,
                            line: 1,
                            column: 16,
                        },
                    },
                    separator: '|',
                    children: [
                        {
                            type: ListItemNodeType.Method,
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
                            value: 'put',
                            exception: true,
                        },
                        {
                            type: ListItemNodeType.Method,
                            loc: {
                                start: {
                                    offset: 6,
                                    line: 1,
                                    column: 7,
                                },
                                end: {
                                    offset: 9,
                                    line: 1,
                                    column: 10,
                                },
                            },
                            value: 'get',
                            exception: true,
                        },
                        {
                            type: ListItemNodeType.Method,
                            loc: {
                                start: {
                                    offset: 11,
                                    line: 1,
                                    column: 12,
                                },
                                end: {
                                    offset: 15,
                                    line: 1,
                                    column: 16,
                                },
                            },
                            value: 'head',
                            exception: true,
                        },
                    ],
                },
            },

            {
                actual: '~get|post|~head',
                expected: {
                    type: ListNodeType.MethodList,
                    loc: {
                        start: {
                            offset: 0,
                            line: 1,
                            column: 1,
                        },
                        end: {
                            offset: 15,
                            line: 1,
                            column: 16,
                        },
                    },
                    separator: '|',
                    children: [
                        {
                            type: ListItemNodeType.Method,
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
                            value: 'get',
                            exception: true,
                        },
                        {
                            type: ListItemNodeType.Method,
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
                            value: 'post',
                            exception: false,
                        },
                        {
                            type: ListItemNodeType.Method,
                            loc: {
                                start: {
                                    offset: 11,
                                    line: 1,
                                    column: 12,
                                },
                                end: {
                                    offset: 15,
                                    line: 1,
                                    column: 16,
                                },
                            },
                            value: 'head',
                            exception: true,
                        },
                    ],
                },
            },

            {
                actual: '~get|  post    |   put |        ~head',
                expected: {
                    type: ListNodeType.MethodList,
                    loc: {
                        start: {
                            offset: 0,
                            line: 1,
                            column: 1,
                        },
                        end: {
                            offset: 37,
                            line: 1,
                            column: 38,
                        },
                    },
                    separator: '|',
                    children: [
                        {
                            type: ListItemNodeType.Method,
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
                            value: 'get',
                            exception: true,
                        },
                        {
                            type: ListItemNodeType.Method,
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
                            value: 'post',
                            exception: false,
                        },
                        {
                            type: ListItemNodeType.Method,
                            loc: {
                                start: {
                                    offset: 19,
                                    line: 1,
                                    column: 20,
                                },
                                end: {
                                    offset: 22,
                                    line: 1,
                                    column: 23,
                                },
                            },
                            value: 'put',
                            exception: false,
                        },
                        {
                            type: ListItemNodeType.Method,
                            loc: {
                                start: {
                                    offset: 33,
                                    line: 1,
                                    column: 34,
                                },
                                end: {
                                    offset: 37,
                                    line: 1,
                                    column: 38,
                                },
                            },
                            value: 'head',
                            exception: true,
                        },
                    ],
                },
            },

            {
                actual: '~post|  head    |   get |        ~put',
                expected: {
                    type: ListNodeType.MethodList,
                    loc: {
                        start: {
                            offset: 0,
                            line: 1,
                            column: 1,
                        },
                        end: {
                            offset: 37,
                            line: 1,
                            column: 38,
                        },
                    },
                    separator: '|',
                    children: [
                        {
                            type: ListItemNodeType.Method,
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
                            type: ListItemNodeType.Method,
                            loc: {
                                start: {
                                    offset: 8,
                                    line: 1,
                                    column: 9,
                                },
                                end: {
                                    offset: 12,
                                    line: 1,
                                    column: 13,
                                },
                            },
                            value: 'head',
                            exception: false,
                        },
                        {
                            type: ListItemNodeType.Method,
                            loc: {
                                start: {
                                    offset: 20,
                                    line: 1,
                                    column: 21,
                                },
                                end: {
                                    offset: 23,
                                    line: 1,
                                    column: 24,
                                },
                            },
                            value: 'get',
                            exception: false,
                        },
                        {
                            type: ListItemNodeType.Method,
                            loc: {
                                start: {
                                    offset: 34,
                                    line: 1,
                                    column: 35,
                                },
                                end: {
                                    offset: 37,
                                    line: 1,
                                    column: 38,
                                },
                            },
                            value: 'put',
                            exception: true,
                        },
                    ],
                },
            },
        ])('$actual', ({ actual, expected }) => {
            expect(MethodListParser.parse(actual)).toEqual(expected);
        });
    });
});
