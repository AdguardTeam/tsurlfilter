import { describe, test, expect } from 'vitest';

import { HintCommentParser } from '../../../src/parser/comment/hint-comment-parser.js';
import { EMPTY, SPACE } from '../../../src/utils/constants.js';
import { defaultParserOptions } from '../../../src/parser/options.js';
import { HintCommentGenerator } from '../../../src/generator/comment/hint-comment-generator.js';
import { HintCommentSerializer } from '../../../src/serializer/comment/hint-comment-serializer.js';
import { HintCommentDeserializer } from '../../../src/deserializer/comment/hint-comment-deserializer.js';

describe('HintCommentParser', () => {
    test('isHintRule', () => {
        // TODO: Refactor to test.each
        expect(HintCommentParser.isHintRule(EMPTY)).toBeFalsy();
        expect(HintCommentParser.isHintRule(SPACE)).toBeFalsy();
        expect(HintCommentParser.isHintRule('! comment')).toBeFalsy();
        expect(HintCommentParser.isHintRule('# comment')).toBeFalsy();
        expect(HintCommentParser.isHintRule('#+')).toBeFalsy();
        expect(HintCommentParser.isHintRule('#+ HINT_NAME1(PARAMS) HINT_NAME2(PARAMS)')).toBeFalsy();

        expect(HintCommentParser.isHintRule('!+NOT_OPTIMIZED')).toBeTruthy();
        expect(HintCommentParser.isHintRule('!+ NOT_OPTIMIZED')).toBeTruthy();
        expect(HintCommentParser.isHintRule('!+ HINT_NAME1(PARAMS) HINT_NAME2(PARAMS)')).toBeTruthy();
    });

    test('parse', () => {
        // TODO: Refactor to test.each
        // Without parameters
        expect(HintCommentParser.parse('!+NOT_OPTIMIZED')).toMatchObject({
            type: 'HintCommentRule',
            start: 0,
            end: 15,
            category: 'Comment',
            syntax: 'AdGuard',
            children: [
                {
                    type: 'Hint',
                    start: 2,
                    end: 15,
                    name: {
                        type: 'Value',
                        start: 2,
                        end: 15,
                        value: 'NOT_OPTIMIZED',
                    },
                },
            ],
        });

        expect(HintCommentParser.parse('!+ NOT_OPTIMIZED')).toMatchObject({
            type: 'HintCommentRule',
            start: 0,
            end: 16,
            category: 'Comment',
            syntax: 'AdGuard',
            children: [
                {
                    type: 'Hint',
                    start: 3,
                    end: 16,
                    name: {
                        type: 'Value',
                        start: 3,
                        end: 16,
                        value: 'NOT_OPTIMIZED',
                    },
                },
            ],
        });

        // Multiple, without parameters
        expect(HintCommentParser.parse('!+ HINT_NAME1 HINT_NAME2')).toMatchObject({
            type: 'HintCommentRule',
            start: 0,
            end: 24,
            category: 'Comment',
            syntax: 'AdGuard',
            children: [
                {
                    type: 'Hint',
                    start: 3,
                    end: 13,
                    name: {
                        type: 'Value',
                        start: 3,
                        end: 13,
                        value: 'HINT_NAME1',
                    },
                },
                {
                    type: 'Hint',
                    start: 14,
                    end: 24,
                    name: {
                        type: 'Value',
                        start: 14,
                        end: 24,
                        value: 'HINT_NAME2',
                    },
                },
            ],
        });

        // Without parameters, but with empty parameter list ()
        expect(HintCommentParser.parse('!+ HINT_NAME1()')).toMatchObject({
            type: 'HintCommentRule',
            start: 0,
            end: 15,
            category: 'Comment',
            syntax: 'AdGuard',
            children: [
                {
                    type: 'Hint',
                    start: 3,
                    end: 15,
                    name: {
                        type: 'Value',
                        start: 3,
                        end: 13,
                        value: 'HINT_NAME1',
                    },
                    params: {
                        type: 'ParameterList',
                        start: 14,
                        end: 14,
                        children: [],
                    },
                },
            ],
        });

        expect(HintCommentParser.parse('!+ HINT_NAME1(     )')).toMatchObject({
            type: 'HintCommentRule',
            start: 0,
            end: 20,
            category: 'Comment',
            syntax: 'AdGuard',
            children: [
                {
                    type: 'Hint',
                    start: 3,
                    end: 20,
                    name: {
                        type: 'Value',
                        start: 3,
                        end: 13,
                        value: 'HINT_NAME1',
                    },
                    params: {
                        type: 'ParameterList',
                        start: 14,
                        end: 19,
                        children: [
                            null,
                        ],
                    },
                },
            ],
        });

        expect(HintCommentParser.parse('!+ HINT_NAME1() HINT_NAME2()')).toMatchObject({
            type: 'HintCommentRule',
            start: 0,
            end: 28,
            category: 'Comment',
            syntax: 'AdGuard',
            children: [
                {
                    type: 'Hint',
                    start: 3,
                    end: 15,
                    name: {
                        type: 'Value',
                        start: 3,
                        end: 13,
                        value: 'HINT_NAME1',
                    },
                    params: {
                        type: 'ParameterList',
                        start: 14,
                        end: 14,
                        children: [],
                    },
                },
                {
                    type: 'Hint',
                    start: 16,
                    end: 28,
                    name: {
                        type: 'Value',
                        start: 16,
                        end: 26,
                        value: 'HINT_NAME2',
                    },
                    params: {
                        type: 'ParameterList',
                        start: 27,
                        end: 27,
                        children: [],
                    },
                },
            ],
        });

        // Variadic
        expect(HintCommentParser.parse('!+ HINT_NAME1(param0, param1) HINT_NAME2()')).toMatchObject({
            type: 'HintCommentRule',
            start: 0,
            end: 42,
            category: 'Comment',
            syntax: 'AdGuard',
            children: [
                {
                    type: 'Hint',
                    start: 3,
                    end: 29,
                    name: {
                        type: 'Value',
                        start: 3,
                        end: 13,
                        value: 'HINT_NAME1',
                    },
                    params: {
                        type: 'ParameterList',
                        start: 14,
                        end: 28,
                        children: [
                            {
                                type: 'Value',
                                start: 14,
                                end: 20,
                                value: 'param0',
                            },
                            {
                                type: 'Value',
                                start: 22,
                                end: 28,
                                value: 'param1',
                            },
                        ],
                    },
                },
                {
                    type: 'Hint',
                    start: 30,
                    end: 42,
                    name: {
                        type: 'Value',
                        start: 30,
                        end: 40,
                        value: 'HINT_NAME2',
                    },
                    params: {
                        type: 'ParameterList',
                        start: 41,
                        end: 41,
                        children: [],
                    },
                },
            ],
        });

        expect(HintCommentParser.parse('!+ HINT_NAME1(param0, param1) HINT_NAME2(param0)')).toMatchObject(
            {
                type: 'HintCommentRule',
                start: 0,
                end: 48,
                category: 'Comment',
                syntax: 'AdGuard',
                children: [
                    {
                        type: 'Hint',
                        start: 3,
                        end: 29,
                        name: {
                            type: 'Value',
                            start: 3,
                            end: 13,
                            value: 'HINT_NAME1',
                        },
                        params: {
                            type: 'ParameterList',
                            start: 14,
                            end: 28,
                            children: [
                                {
                                    type: 'Value',
                                    start: 14,
                                    end: 20,
                                    value: 'param0',
                                },
                                {
                                    type: 'Value',
                                    start: 22,
                                    end: 28,
                                    value: 'param1',
                                },
                            ],
                        },
                    },
                    {
                        type: 'Hint',
                        start: 30,
                        end: 48,
                        name: {
                            type: 'Value',
                            start: 30,
                            end: 40,
                            value: 'HINT_NAME2',
                        },
                        params: {
                            type: 'ParameterList',
                            start: 41,
                            end: 47,
                            children: [
                                {
                                    type: 'Value',
                                    start: 41,
                                    end: 47,
                                    value: 'param0',
                                },
                            ],
                        },
                    },
                ],
            },
        );

        // Skipped parameters
        expect(HintCommentParser.parse('!+ HINT_NAME(param0, , param1)')).toMatchObject({
            type: 'HintCommentRule',
            start: 0,
            end: 30,
            category: 'Comment',
            syntax: 'AdGuard',
            children: [
                {
                    type: 'Hint',
                    start: 3,
                    end: 30,
                    name: {
                        type: 'Value',
                        start: 3,
                        end: 12,
                        value: 'HINT_NAME',
                    },
                    params: {
                        type: 'ParameterList',
                        start: 13,
                        end: 29,
                        children: [
                            {
                                type: 'Value',
                                start: 13,
                                end: 19,
                                value: 'param0',
                            },
                            null,
                            {
                                type: 'Value',
                                start: 23,
                                end: 29,
                                value: 'param1',
                            },
                        ],
                    },
                },
            ],
        });

        expect(HintCommentParser.parse('!+ HINT_NAME(param0,    , param1)')).toMatchObject({
            type: 'HintCommentRule',
            start: 0,
            end: 33,
            category: 'Comment',
            syntax: 'AdGuard',
            children: [
                {
                    type: 'Hint',
                    start: 3,
                    end: 33,
                    name: {
                        type: 'Value',
                        start: 3,
                        end: 12,
                        value: 'HINT_NAME',
                    },
                    params: {
                        type: 'ParameterList',
                        start: 13,
                        end: 32,
                        children: [
                            {
                                type: 'Value',
                                start: 13,
                                end: 19,
                                value: 'param0',
                            },
                            null,
                            {
                                type: 'Value',
                                start: 26,
                                end: 32,
                                value: 'param1',
                            },
                        ],
                    },
                },
            ],
        });

        expect(HintCommentParser.parse('!+ HINT_NAME(param0, , , )')).toMatchObject(
            {
                type: 'HintCommentRule',
                start: 0,
                end: 26,
                category: 'Comment',
                syntax: 'AdGuard',
                children: [
                    {
                        type: 'Hint',
                        start: 3,
                        end: 26,
                        name: {
                            type: 'Value',
                            start: 3,
                            end: 12,
                            value: 'HINT_NAME',
                        },
                        params: {
                            type: 'ParameterList',
                            start: 13,
                            end: 25,
                            children: [
                                {
                                    type: 'Value',
                                    start: 13,
                                    end: 19,
                                    value: 'param0',
                                },
                                null,
                                null,
                                null,
                            ],
                        },
                    },
                ],
            },
        );

        expect(HintCommentParser.parse('!+ HINT_NAME( , , , )')).toMatchObject(
            {
                type: 'HintCommentRule',
                start: 0,
                end: 21,
                category: 'Comment',
                syntax: 'AdGuard',
                children: [
                    {
                        type: 'Hint',
                        start: 3,
                        end: 21,
                        name: {
                            type: 'Value',
                            start: 3,
                            end: 12,
                            value: 'HINT_NAME',
                        },
                        params: {
                            type: 'ParameterList',
                            start: 13,
                            end: 20,
                            children: [
                                null,
                                null,
                                null,
                                null,
                            ],
                        },
                    },
                ],
            },
        );

        expect(HintCommentParser.parse('!+ HINT_NAME(,,,)')).toMatchObject({
            type: 'HintCommentRule',
            start: 0,
            end: 17,
            category: 'Comment',
            syntax: 'AdGuard',
            children: [
                {
                    type: 'Hint',
                    start: 3,
                    end: 17,
                    name: {
                        type: 'Value',
                        start: 3,
                        end: 12,
                        value: 'HINT_NAME',
                    },
                    params: {
                        type: 'ParameterList',
                        start: 13,
                        end: 16,
                        children: [
                            null,
                            null,
                            null,
                            null,
                        ],
                    },
                },
            ],
        });

        // Spaces
        expect(HintCommentParser.parse('!+ HINT_NAME(    p0  ,   p1 ,   p2 ,     p3)')).toMatchObject({
            type: 'HintCommentRule',
            start: 0,
            end: 44,
            category: 'Comment',
            syntax: 'AdGuard',
            children: [
                {
                    type: 'Hint',
                    start: 3,
                    end: 44,
                    name: {
                        type: 'Value',
                        start: 3,
                        end: 12,
                        value: 'HINT_NAME',
                    },
                    params: {
                        type: 'ParameterList',
                        start: 13,
                        end: 43,
                        children: [
                            {
                                type: 'Value',
                                start: 17,
                                end: 19,
                                value: 'p0',
                            },
                            {
                                type: 'Value',
                                start: 25,
                                end: 27,
                                value: 'p1',
                            },
                            {
                                type: 'Value',
                                start: 32,
                                end: 34,
                                value: 'p2',
                            },
                            {
                                type: 'Value',
                                start: 41,
                                end: 43,
                                value: 'p3',
                            },
                        ],
                    },
                },
            ],
        });

        expect(HintCommentParser.parse('!+ HINT_NAME(hello world, hello   world)')).toMatchObject({
            type: 'HintCommentRule',
            start: 0,
            end: 40,
            category: 'Comment',
            syntax: 'AdGuard',
            children: [
                {
                    type: 'Hint',
                    start: 3,
                    end: 40,
                    name: {
                        type: 'Value',
                        start: 3,
                        end: 12,
                        value: 'HINT_NAME',
                    },
                    params: {
                        type: 'ParameterList',
                        start: 13,
                        end: 39,
                        children: [
                            {
                                type: 'Value',
                                start: 13,
                                end: 24,
                                value: 'hello world',
                            },
                            {
                                type: 'Value',
                                start: 26,
                                end: 39,
                                value: 'hello   world',
                            },
                        ],
                    },
                },
            ],
        });

        expect(HintCommentParser.parse('!+ hint_name(hello world, hello   world)')).toMatchObject({
            type: 'HintCommentRule',
            start: 0,
            end: 40,
            category: 'Comment',
            syntax: 'AdGuard',
            children: [
                {
                    type: 'Hint',
                    start: 3,
                    end: 40,
                    name: {
                        type: 'Value',
                        start: 3,
                        end: 12,
                        value: 'hint_name',
                    },
                    params: {
                        type: 'ParameterList',
                        start: 13,
                        end: 39,
                        children: [
                            {
                                type: 'Value',
                                start: 13,
                                end: 24,
                                value: 'hello world',
                            },
                            {
                                type: 'Value',
                                start: 26,
                                end: 39,
                                value: 'hello   world',
                            },
                        ],
                    },
                },
            ],
        });

        // HintRuleParser.parse() will throw an error
        expect(() => HintCommentParser.parse('!+')).toThrowError('Empty hint rule');

        // HintParser.parse() will throw an error
        expect(() => HintCommentParser.parse('!+ ')).toThrowError('Empty hint name');

        expect(() => HintCommentParser.parse('!++')).toThrowError(
            'Invalid character "+" in hint name: "+"',
        );

        expect(() => HintCommentParser.parse('!+ (arg0)')).toThrowError('Empty hint name');

        // Missing parentheses
        expect(() => HintCommentParser.parse('!+ HINT_NAME(')).toThrowError(/^Missing closing parenthesis/);

        expect(() => HintCommentParser.parse('!+ HINT_NAME)')).toThrowError(
            'Invalid character ")" in hint name: ")"',
        );

        // Nesting isn't supported
        expect(() => HintCommentParser.parse('!+ HINT_NAME1(HINT_NAME2(PARAM0))')).toThrowError(
            'Invalid hint: nested parentheses are not allowed',
        );
    });

    describe('parser options should work as expected', () => {
        // TODO: Add template for test.each
        test.each([
            {
                actual: '!+ HINT_NAME1(param0, param1) HINT_NAME2(param0)',
                expected: {
                    type: 'HintCommentRule',
                    category: 'Comment',
                    syntax: 'AdGuard',
                    raws: {
                        text: '!+ HINT_NAME1(param0, param1) HINT_NAME2(param0)',
                    },
                    children: [
                        {
                            type: 'Hint',
                            name: {
                                type: 'Value',
                                value: 'HINT_NAME1',
                            },
                            params: {
                                type: 'ParameterList',
                                children: [
                                    {
                                        type: 'Value',
                                        value: 'param0',
                                    },
                                    {
                                        type: 'Value',
                                        value: 'param1',
                                    },
                                ],
                            },
                        },
                        {
                            type: 'Hint',
                            name: {
                                type: 'Value',
                                value: 'HINT_NAME2',
                            },
                            params: {
                                type: 'ParameterList',
                                children: [
                                    {
                                        type: 'Value',
                                        value: 'param0',
                                    },
                                ],
                            },
                        },
                    ],
                },
            },
        ])('isLocIncluded should work for $actual', ({ actual, expected }) => {
            expect(
                HintCommentParser.parse(actual, { ...defaultParserOptions, isLocIncluded: false }),
            ).toEqual(expected);
        });
    });

    test('generate', () => {
        const parseAndGenerate = (raw: string) => {
            const ast = HintCommentParser.parse(raw);

            if (ast) {
                return HintCommentGenerator.generate(ast);
            }

            return null;
        };

        // TODO: Refactor to test.each
        expect(parseAndGenerate('!+ NOT_OPTIMIZED')).toEqual('!+ NOT_OPTIMIZED');
        expect(parseAndGenerate('!+NOT_OPTIMIZED')).toEqual('!+ NOT_OPTIMIZED');
        expect(parseAndGenerate('!+ NOT_OPTIMIZED()')).toEqual('!+ NOT_OPTIMIZED');
        expect(parseAndGenerate('!+    NOT_OPTIMIZED   ')).toEqual('!+ NOT_OPTIMIZED');

        expect(parseAndGenerate('!+ PLATFORM(,,windows,,)')).toEqual('!+ PLATFORM(, , windows, , )');
        expect(parseAndGenerate('!+ PLATFORM(,,,)')).toEqual('!+ PLATFORM(, , , )');

        expect(parseAndGenerate('!+ NOT_OPTIMIZED PLATFORM(windows)')).toEqual('!+ NOT_OPTIMIZED PLATFORM(windows)');

        expect(parseAndGenerate('!+      NOT_OPTIMIZED     PLATFORM(     windows   )    ')).toEqual(
            '!+ NOT_OPTIMIZED PLATFORM(windows)',
        );

        expect(parseAndGenerate('!+ NOT_OPTIMIZED PLATFORM(windows) NOT_PLATFORM(mac)')).toEqual(
            '!+ NOT_OPTIMIZED PLATFORM(windows) NOT_PLATFORM(mac)',
        );

        expect(parseAndGenerate('!+  NOT_OPTIMIZED  PLATFORM( windows )  NOT_PLATFORM( mac )')).toEqual(
            '!+ NOT_OPTIMIZED PLATFORM(windows) NOT_PLATFORM(mac)',
        );

        expect(parseAndGenerate('!+  NOT_OPTIMIZED  PLATFORM( windows     ,  mac  )  NOT_PLATFORM( mac )')).toEqual(
            '!+ NOT_OPTIMIZED PLATFORM(windows, mac) NOT_PLATFORM(mac)',
        );
    });

    describe('serialize & deserialize', () => {
        test.each([
            '!+ NOT_OPTIMIZED',
            '!+ NOT_OPTIMIZED PLATFORM(windows)',
            '!+ NOT_OPTIMIZED PLATFORM(, , ,)',
            '!+ NOT_OPTIMIZED PLATFORM(windows) NOT_PLATFORM(mac, ios)',
        ])("should serialize and deserialize '%p'", async (input) => {
            await expect(input).toBeSerializedAndDeserializedProperly(
                HintCommentParser,
                HintCommentGenerator,
                HintCommentSerializer,
                HintCommentDeserializer,
            );
        });
    });
});
