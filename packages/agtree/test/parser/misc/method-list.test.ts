import { describe, test, expect } from 'vitest';

import { MethodListParser } from '../../../src/parser/misc/method-list-parser.js';
import { ListNodeType, ListItemNodeType } from '../../../src/nodes/index.js';
import { EMPTY } from '../../../src/utils/constants.js';

describe('MethodListParser', () => {
    // invalid inputs are tested in `list-helpers.test.ts`

    describe('parse should work as expected on valid input', () => {
        test.each([
            {
                actual: EMPTY,
                expected: {
                    type: ListNodeType.MethodList,
                    start: 0,
                    end: 0,
                    separator: '|',
                    children: [],
                },
            },

            {
                actual: 'get',
                expected: {
                    type: ListNodeType.MethodList,
                    start: 0,
                    end: 3,
                    separator: '|',
                    children: [
                        {
                            type: ListItemNodeType.Method,
                            start: 0,
                            end: 3,
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
                    start: 0,
                    end: 12,
                    separator: '|',
                    children: [
                        {
                            type: ListItemNodeType.Method,
                            start: 0,
                            end: 3,
                            value: 'get',
                            exception: false,
                        },
                        {
                            type: ListItemNodeType.Method,
                            start: 4,
                            end: 8,
                            value: 'post',
                            exception: false,
                        },
                        {
                            type: ListItemNodeType.Method,
                            start: 9,
                            end: 12,
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
                    start: 0,
                    end: 4,
                    separator: '|',
                    children: [
                        {
                            type: ListItemNodeType.Method,
                            start: 1,
                            end: 4,
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
                    start: 0,
                    end: 10,
                    separator: '|',
                    children: [
                        {
                            type: ListItemNodeType.Method,
                            start: 1,
                            end: 5,
                            value: 'post',
                            exception: true,
                        },
                        {
                            type: ListItemNodeType.Method,
                            start: 7,
                            end: 10,
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
                    start: 0,
                    end: 15,
                    separator: '|',
                    children: [
                        {
                            type: ListItemNodeType.Method,
                            start: 1,
                            end: 4,
                            value: 'put',
                            exception: true,
                        },
                        {
                            type: ListItemNodeType.Method,
                            start: 6,
                            end: 9,
                            value: 'get',
                            exception: true,
                        },
                        {
                            type: ListItemNodeType.Method,
                            start: 11,
                            end: 15,
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
                    start: 0,
                    end: 15,
                    separator: '|',
                    children: [
                        {
                            type: ListItemNodeType.Method,
                            start: 1,
                            end: 4,
                            value: 'get',
                            exception: true,
                        },
                        {
                            type: ListItemNodeType.Method,
                            start: 5,
                            end: 9,
                            value: 'post',
                            exception: false,
                        },
                        {
                            type: ListItemNodeType.Method,
                            start: 11,
                            end: 15,
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
                    start: 0,
                    end: 37,
                    separator: '|',
                    children: [
                        {
                            type: ListItemNodeType.Method,
                            start: 1,
                            end: 4,
                            value: 'get',
                            exception: true,
                        },
                        {
                            type: ListItemNodeType.Method,
                            start: 7,
                            end: 11,
                            value: 'post',
                            exception: false,
                        },
                        {
                            type: ListItemNodeType.Method,
                            start: 19,
                            end: 22,
                            value: 'put',
                            exception: false,
                        },
                        {
                            type: ListItemNodeType.Method,
                            start: 33,
                            end: 37,
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
                    start: 0,
                    end: 37,
                    separator: '|',
                    children: [
                        {
                            type: ListItemNodeType.Method,
                            start: 1,
                            end: 5,
                            value: 'post',
                            exception: true,
                        },
                        {
                            type: ListItemNodeType.Method,
                            start: 8,
                            end: 12,
                            value: 'head',
                            exception: false,
                        },
                        {
                            type: ListItemNodeType.Method,
                            start: 20,
                            end: 23,
                            value: 'get',
                            exception: false,
                        },
                        {
                            type: ListItemNodeType.Method,
                            start: 34,
                            end: 37,
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

    describe('parser options should work as expected', () => {
        test.each([
            {
                actual: 'get|post|put',
                expected: {
                    type: ListNodeType.MethodList,
                    separator: '|',
                    children: [
                        {
                            type: ListItemNodeType.Method,
                            value: 'get',
                            exception: false,
                        },
                        {
                            type: ListItemNodeType.Method,
                            value: 'post',
                            exception: false,
                        },
                        {
                            type: ListItemNodeType.Method,
                            value: 'put',
                            exception: false,
                        },
                    ],
                },
            },
        ])('isLocIncluded should work for $actual', ({ actual, expected }) => {
            expect(MethodListParser.parse(actual, { isLocIncluded: false })).toEqual(expected);
        });
    });
});
