import { HintCommentRuleParser } from '../../../src/parser/comment/hint-rule';
import { EMPTY, SPACE } from '../../../src/utils/constants';

describe('HintCommentRuleParser', () => {
    test('isHintRule', () => {
        // TODO: Refactor to test.each
        expect(HintCommentRuleParser.isHintRule(EMPTY)).toBeFalsy();
        expect(HintCommentRuleParser.isHintRule(SPACE)).toBeFalsy();
        expect(HintCommentRuleParser.isHintRule('! comment')).toBeFalsy();
        expect(HintCommentRuleParser.isHintRule('# comment')).toBeFalsy();
        expect(HintCommentRuleParser.isHintRule('#+')).toBeFalsy();
        expect(HintCommentRuleParser.isHintRule('#+ HINT_NAME1(PARAMS) HINT_NAME2(PARAMS)')).toBeFalsy();

        expect(HintCommentRuleParser.isHintRule('!+NOT_OPTIMIZED')).toBeTruthy();
        expect(HintCommentRuleParser.isHintRule('!+ NOT_OPTIMIZED')).toBeTruthy();
        expect(HintCommentRuleParser.isHintRule('!+ HINT_NAME1(PARAMS) HINT_NAME2(PARAMS)')).toBeTruthy();
    });

    test('parse', () => {
        // TODO: Refactor to test.each
        // Without parameters
        expect(HintCommentRuleParser.parse('!+NOT_OPTIMIZED')).toMatchObject({
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

        expect(HintCommentRuleParser.parse('!+ NOT_OPTIMIZED')).toMatchObject({
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
        expect(HintCommentRuleParser.parse('!+ HINT_NAME1 HINT_NAME2')).toMatchObject({
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
        expect(HintCommentRuleParser.parse('!+ HINT_NAME1()')).toMatchObject({
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

        expect(HintCommentRuleParser.parse('!+ HINT_NAME1(     )')).toMatchObject({
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
                            {
                                type: 'Parameter',
                                start: 14,
                                end: 19,
                                value: '',
                            },
                        ],
                    },
                },
            ],
        });

        expect(HintCommentRuleParser.parse('!+ HINT_NAME1() HINT_NAME2()')).toMatchObject({
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
        expect(HintCommentRuleParser.parse('!+ HINT_NAME1(param0, param1) HINT_NAME2()')).toMatchObject({
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
                                type: 'Parameter',
                                start: 14,
                                end: 20,
                                value: 'param0',
                            },
                            {
                                type: 'Parameter',
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

        expect(HintCommentRuleParser.parse('!+ HINT_NAME1(param0, param1) HINT_NAME2(param0)')).toMatchObject(
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
                                    type: 'Parameter',
                                    start: 14,
                                    end: 20,
                                    value: 'param0',
                                },
                                {
                                    type: 'Parameter',
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
                                    type: 'Parameter',
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
        expect(HintCommentRuleParser.parse('!+ HINT_NAME(param0, , param1)')).toMatchObject({
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
                                type: 'Parameter',
                                start: 13,
                                end: 19,
                                value: 'param0',
                            },
                            {
                                type: 'Parameter',
                                start: 20,
                                end: 21,
                                value: '',
                            },
                            {
                                type: 'Parameter',
                                start: 23,
                                end: 29,
                                value: 'param1',
                            },
                        ],
                    },
                },
            ],
        });

        expect(HintCommentRuleParser.parse('!+ HINT_NAME(param0,    , param1)')).toMatchObject({
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
                                type: 'Parameter',
                                start: 13,
                                end: 19,
                                value: 'param0',
                            },
                            {
                                type: 'Parameter',
                                start: 20,
                                end: 24,
                                value: '',
                            },
                            {
                                type: 'Parameter',
                                start: 26,
                                end: 32,
                                value: 'param1',
                            },
                        ],
                    },
                },
            ],
        });

        expect(HintCommentRuleParser.parse('!+ HINT_NAME(param0, , , )')).toMatchObject(
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
                                    type: 'Parameter',
                                    start: 13,
                                    end: 19,
                                    value: 'param0',
                                },
                                {
                                    type: 'Parameter',
                                    start: 20,
                                    end: 21,
                                    value: '',
                                },
                                {
                                    type: 'Parameter',
                                    start: 22,
                                    end: 23,
                                    value: '',
                                },
                                {
                                    type: 'Parameter',
                                    start: 24,
                                    end: 25,
                                    value: '',
                                },
                            ],
                        },
                    },
                ],
            },
        );

        expect(HintCommentRuleParser.parse('!+ HINT_NAME( , , , )')).toMatchObject(
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
                                {
                                    type: 'Parameter',
                                    start: 13,
                                    end: 14,
                                    value: '',
                                },
                                {
                                    type: 'Parameter',
                                    start: 15,
                                    end: 16,
                                    value: '',
                                },
                                {
                                    type: 'Parameter',
                                    start: 17,
                                    end: 18,
                                    value: '',
                                },
                                {
                                    type: 'Parameter',
                                    start: 19,
                                    end: 20,
                                    value: '',
                                },
                            ],
                        },
                    },
                ],
            },
        );

        expect(HintCommentRuleParser.parse('!+ HINT_NAME(,,,)')).toMatchObject({
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
                            {
                                type: 'Parameter',
                                start: 13,
                                end: 13,
                                value: '',
                            },
                            {
                                type: 'Parameter',
                                start: 14,
                                end: 14,
                                value: '',
                            },
                            {
                                type: 'Parameter',
                                start: 15,
                                end: 15,
                                value: '',
                            },
                        ],
                    },
                },
            ],
        });

        // Spaces
        expect(HintCommentRuleParser.parse('!+ HINT_NAME(    p0  ,   p1 ,   p2 ,     p3)')).toMatchObject({
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
                                type: 'Parameter',
                                start: 17,
                                end: 19,
                                value: 'p0',
                            },
                            {
                                type: 'Parameter',
                                start: 25,
                                end: 27,
                                value: 'p1',
                            },
                            {
                                type: 'Parameter',
                                start: 32,
                                end: 34,
                                value: 'p2',
                            },
                            {
                                type: 'Parameter',
                                start: 41,
                                end: 43,
                                value: 'p3',
                            },
                        ],
                    },
                },
            ],
        });

        expect(HintCommentRuleParser.parse('!+ HINT_NAME(hello world, hello   world)')).toMatchObject({
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
                                type: 'Parameter',
                                start: 13,
                                end: 24,
                                value: 'hello world',
                            },
                            {
                                type: 'Parameter',
                                start: 26,
                                end: 39,
                                value: 'hello   world',
                            },
                        ],
                    },
                },
            ],
        });

        expect(HintCommentRuleParser.parse('!+ hint_name(hello world, hello   world)')).toMatchObject({
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
                                type: 'Parameter',
                                start: 13,
                                end: 24,
                                value: 'hello world',
                            },
                            {
                                type: 'Parameter',
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
        expect(() => HintCommentRuleParser.parse('!+')).toThrowError('Empty hint rule');

        // HintParser.parse() will throw an error
        expect(() => HintCommentRuleParser.parse('!+ ')).toThrowError('Empty hint name');

        expect(() => HintCommentRuleParser.parse('!++')).toThrowError(
            'Invalid character "+" in hint name: "+"',
        );

        expect(() => HintCommentRuleParser.parse('!+ (arg0)')).toThrowError('Empty hint name');

        // Missing parentheses
        expect(() => HintCommentRuleParser.parse('!+ HINT_NAME(')).toThrowError(/^Missing closing parenthesis/);

        expect(() => HintCommentRuleParser.parse('!+ HINT_NAME)')).toThrowError(
            'Invalid character ")" in hint name: ")"',
        );

        // Nesting isn't supported
        expect(() => HintCommentRuleParser.parse('!+ HINT_NAME1(HINT_NAME2(PARAM0))')).toThrowError(
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
                                        type: 'Parameter',
                                        value: 'param0',
                                    },
                                    {
                                        type: 'Parameter',
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
                                        type: 'Parameter',
                                        value: 'param0',
                                    },
                                ],
                            },
                        },
                    ],
                },
            },
        ])('isLocIncluded should work for $actual', ({ actual, expected }) => {
            expect(HintCommentRuleParser.parse(actual, { isLocIncluded: false })).toEqual(expected);
        });
    });

    test('generate', () => {
        const parseAndGenerate = (raw: string) => {
            const ast = HintCommentRuleParser.parse(raw);

            if (ast) {
                return HintCommentRuleParser.generate(ast);
            }

            return null;
        };

        // TODO: Refactor to test.each
        expect(parseAndGenerate('!+ NOT_OPTIMIZED')).toEqual('!+ NOT_OPTIMIZED');
        expect(parseAndGenerate('!+NOT_OPTIMIZED')).toEqual('!+ NOT_OPTIMIZED');
        expect(parseAndGenerate('!+ NOT_OPTIMIZED()')).toEqual('!+ NOT_OPTIMIZED');
        expect(parseAndGenerate('!+    NOT_OPTIMIZED   ')).toEqual('!+ NOT_OPTIMIZED');

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
});
