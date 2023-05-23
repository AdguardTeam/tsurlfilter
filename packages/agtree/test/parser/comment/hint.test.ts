import { HintCommentRuleParser } from '../../../src/parser/comment/hint-rule';
import { EMPTY, SPACE } from '../../../src/utils/constants';

describe('HintCommentRuleParser', () => {
    test('isHintRule', () => {
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
        // Without parameters
        expect(HintCommentRuleParser.parse('!+NOT_OPTIMIZED')).toMatchObject({
            type: 'HintCommentRule',
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
            category: 'Comment',
            syntax: 'AdGuard',
            children: [
                {
                    type: 'Hint',
                    loc: {
                        start: {
                            offset: 2,
                            line: 1,
                            column: 3,
                        },
                        end: {
                            offset: 15,
                            line: 1,
                            column: 16,
                        },
                    },
                    name: {
                        type: 'Value',
                        loc: {
                            start: {
                                offset: 2,
                                line: 1,
                                column: 3,
                            },
                            end: {
                                offset: 15,
                                line: 1,
                                column: 16,
                            },
                        },
                        value: 'NOT_OPTIMIZED',
                    },
                },
            ],
        });

        expect(HintCommentRuleParser.parse('!+ NOT_OPTIMIZED')).toMatchObject({
            type: 'HintCommentRule',
            loc: {
                start: {
                    offset: 0,
                    line: 1,
                    column: 1,
                },
                end: {
                    offset: 16,
                    line: 1,
                    column: 17,
                },
            },
            category: 'Comment',
            syntax: 'AdGuard',
            children: [
                {
                    type: 'Hint',
                    loc: {
                        start: {
                            offset: 3,
                            line: 1,
                            column: 4,
                        },
                        end: {
                            offset: 16,
                            line: 1,
                            column: 17,
                        },
                    },
                    name: {
                        type: 'Value',
                        loc: {
                            start: {
                                offset: 3,
                                line: 1,
                                column: 4,
                            },
                            end: {
                                offset: 16,
                                line: 1,
                                column: 17,
                            },
                        },
                        value: 'NOT_OPTIMIZED',
                    },
                },
            ],
        });

        // Multiple, without parameters
        expect(HintCommentRuleParser.parse('!+ HINT_NAME1 HINT_NAME2')).toMatchObject({
            type: 'HintCommentRule',
            loc: {
                start: {
                    offset: 0,
                    line: 1,
                    column: 1,
                },
                end: {
                    offset: 24,
                    line: 1,
                    column: 25,
                },
            },
            category: 'Comment',
            syntax: 'AdGuard',
            children: [
                {
                    type: 'Hint',
                    loc: {
                        start: {
                            offset: 3,
                            line: 1,
                            column: 4,
                        },
                        end: {
                            offset: 13,
                            line: 1,
                            column: 14,
                        },
                    },
                    name: {
                        type: 'Value',
                        loc: {
                            start: {
                                offset: 3,
                                line: 1,
                                column: 4,
                            },
                            end: {
                                offset: 13,
                                line: 1,
                                column: 14,
                            },
                        },
                        value: 'HINT_NAME1',
                    },
                },
                {
                    type: 'Hint',
                    loc: {
                        start: {
                            offset: 14,
                            line: 1,
                            column: 15,
                        },
                        end: {
                            offset: 24,
                            line: 1,
                            column: 25,
                        },
                    },
                    name: {
                        type: 'Value',
                        loc: {
                            start: {
                                offset: 14,
                                line: 1,
                                column: 15,
                            },
                            end: {
                                offset: 24,
                                line: 1,
                                column: 25,
                            },
                        },
                        value: 'HINT_NAME2',
                    },
                },
            ],
        });

        // Without parameters, but with empty parameter list ()
        expect(HintCommentRuleParser.parse('!+ HINT_NAME1()')).toMatchObject({
            type: 'HintCommentRule',
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
            category: 'Comment',
            syntax: 'AdGuard',
            children: [
                {
                    type: 'Hint',
                    loc: {
                        start: {
                            offset: 3,
                            line: 1,
                            column: 4,
                        },
                        end: {
                            offset: 15,
                            line: 1,
                            column: 16,
                        },
                    },
                    name: {
                        type: 'Value',
                        loc: {
                            start: {
                                offset: 3,
                                line: 1,
                                column: 4,
                            },
                            end: {
                                offset: 13,
                                line: 1,
                                column: 14,
                            },
                        },
                        value: 'HINT_NAME1',
                    },
                    params: {
                        type: 'ParameterList',
                        loc: {
                            start: {
                                offset: 14,
                                line: 1,
                                column: 15,
                            },
                            end: {
                                offset: 14,
                                line: 1,
                                column: 15,
                            },
                        },
                        children: [],
                    },
                },
            ],
        });

        expect(HintCommentRuleParser.parse('!+ HINT_NAME1(     )')).toMatchObject({
            type: 'HintCommentRule',
            loc: {
                start: {
                    offset: 0,
                    line: 1,
                    column: 1,
                },
                end: {
                    offset: 20,
                    line: 1,
                    column: 21,
                },
            },
            category: 'Comment',
            syntax: 'AdGuard',
            children: [
                {
                    type: 'Hint',
                    loc: {
                        start: {
                            offset: 3,
                            line: 1,
                            column: 4,
                        },
                        end: {
                            offset: 20,
                            line: 1,
                            column: 21,
                        },
                    },
                    name: {
                        type: 'Value',
                        loc: {
                            start: {
                                offset: 3,
                                line: 1,
                                column: 4,
                            },
                            end: {
                                offset: 13,
                                line: 1,
                                column: 14,
                            },
                        },
                        value: 'HINT_NAME1',
                    },
                    params: {
                        type: 'ParameterList',
                        loc: {
                            start: {
                                offset: 14,
                                line: 1,
                                column: 15,
                            },
                            end: {
                                offset: 19,
                                line: 1,
                                column: 20,
                            },
                        },
                        children: [],
                    },
                },
            ],
        });

        expect(HintCommentRuleParser.parse('!+ HINT_NAME1() HINT_NAME2()')).toMatchObject({
            type: 'HintCommentRule',
            loc: {
                start: {
                    offset: 0,
                    line: 1,
                    column: 1,
                },
                end: {
                    offset: 28,
                    line: 1,
                    column: 29,
                },
            },
            category: 'Comment',
            syntax: 'AdGuard',
            children: [
                {
                    type: 'Hint',
                    loc: {
                        start: {
                            offset: 3,
                            line: 1,
                            column: 4,
                        },
                        end: {
                            offset: 15,
                            line: 1,
                            column: 16,
                        },
                    },
                    name: {
                        type: 'Value',
                        loc: {
                            start: {
                                offset: 3,
                                line: 1,
                                column: 4,
                            },
                            end: {
                                offset: 13,
                                line: 1,
                                column: 14,
                            },
                        },
                        value: 'HINT_NAME1',
                    },
                    params: {
                        type: 'ParameterList',
                        loc: {
                            start: {
                                offset: 14,
                                line: 1,
                                column: 15,
                            },
                            end: {
                                offset: 14,
                                line: 1,
                                column: 15,
                            },
                        },
                        children: [],
                    },
                },
                {
                    type: 'Hint',
                    loc: {
                        start: {
                            offset: 16,
                            line: 1,
                            column: 17,
                        },
                        end: {
                            offset: 28,
                            line: 1,
                            column: 29,
                        },
                    },
                    name: {
                        type: 'Value',
                        loc: {
                            start: {
                                offset: 16,
                                line: 1,
                                column: 17,
                            },
                            end: {
                                offset: 26,
                                line: 1,
                                column: 27,
                            },
                        },
                        value: 'HINT_NAME2',
                    },
                    params: {
                        type: 'ParameterList',
                        loc: {
                            start: {
                                offset: 27,
                                line: 1,
                                column: 28,
                            },
                            end: {
                                offset: 27,
                                line: 1,
                                column: 28,
                            },
                        },
                        children: [],
                    },
                },
            ],
        });

        // Variadic
        expect(HintCommentRuleParser.parse('!+ HINT_NAME1(param0, param1) HINT_NAME2()')).toMatchObject({
            type: 'HintCommentRule',
            loc: {
                start: {
                    offset: 0,
                    line: 1,
                    column: 1,
                },
                end: {
                    offset: 42,
                    line: 1,
                    column: 43,
                },
            },
            category: 'Comment',
            syntax: 'AdGuard',
            children: [
                {
                    type: 'Hint',
                    loc: {
                        start: {
                            offset: 3,
                            line: 1,
                            column: 4,
                        },
                        end: {
                            offset: 29,
                            line: 1,
                            column: 30,
                        },
                    },
                    name: {
                        type: 'Value',
                        loc: {
                            start: {
                                offset: 3,
                                line: 1,
                                column: 4,
                            },
                            end: {
                                offset: 13,
                                line: 1,
                                column: 14,
                            },
                        },
                        value: 'HINT_NAME1',
                    },
                    params: {
                        type: 'ParameterList',
                        loc: {
                            start: {
                                offset: 14,
                                line: 1,
                                column: 15,
                            },
                            end: {
                                offset: 28,
                                line: 1,
                                column: 29,
                            },
                        },
                        children: [
                            {
                                type: 'Parameter',
                                loc: {
                                    start: {
                                        offset: 14,
                                        line: 1,
                                        column: 15,
                                    },
                                    end: {
                                        offset: 20,
                                        line: 1,
                                        column: 21,
                                    },
                                },
                                value: 'param0',
                            },
                            {
                                type: 'Parameter',
                                loc: {
                                    start: {
                                        offset: 22,
                                        line: 1,
                                        column: 23,
                                    },
                                    end: {
                                        offset: 28,
                                        line: 1,
                                        column: 29,
                                    },
                                },
                                value: 'param1',
                            },
                        ],
                    },
                },
                {
                    type: 'Hint',
                    loc: {
                        start: {
                            offset: 30,
                            line: 1,
                            column: 31,
                        },
                        end: {
                            offset: 42,
                            line: 1,
                            column: 43,
                        },
                    },
                    name: {
                        type: 'Value',
                        loc: {
                            start: {
                                offset: 30,
                                line: 1,
                                column: 31,
                            },
                            end: {
                                offset: 40,
                                line: 1,
                                column: 41,
                            },
                        },
                        value: 'HINT_NAME2',
                    },
                    params: {
                        type: 'ParameterList',
                        loc: {
                            start: {
                                offset: 41,
                                line: 1,
                                column: 42,
                            },
                            end: {
                                offset: 41,
                                line: 1,
                                column: 42,
                            },
                        },
                        children: [],
                    },
                },
            ],
        });

        expect(HintCommentRuleParser.parse('!+ HINT_NAME1(param0, param1) HINT_NAME2(param0)')).toMatchObject(
            {
                type: 'HintCommentRule',
                loc: {
                    start: {
                        offset: 0,
                        line: 1,
                        column: 1,
                    },
                    end: {
                        offset: 48,
                        line: 1,
                        column: 49,
                    },
                },
                category: 'Comment',
                syntax: 'AdGuard',
                children: [
                    {
                        type: 'Hint',
                        loc: {
                            start: {
                                offset: 3,
                                line: 1,
                                column: 4,
                            },
                            end: {
                                offset: 29,
                                line: 1,
                                column: 30,
                            },
                        },
                        name: {
                            type: 'Value',
                            loc: {
                                start: {
                                    offset: 3,
                                    line: 1,
                                    column: 4,
                                },
                                end: {
                                    offset: 13,
                                    line: 1,
                                    column: 14,
                                },
                            },
                            value: 'HINT_NAME1',
                        },
                        params: {
                            type: 'ParameterList',
                            loc: {
                                start: {
                                    offset: 14,
                                    line: 1,
                                    column: 15,
                                },
                                end: {
                                    offset: 28,
                                    line: 1,
                                    column: 29,
                                },
                            },
                            children: [
                                {
                                    type: 'Parameter',
                                    loc: {
                                        start: {
                                            offset: 14,
                                            line: 1,
                                            column: 15,
                                        },
                                        end: {
                                            offset: 20,
                                            line: 1,
                                            column: 21,
                                        },
                                    },
                                    value: 'param0',
                                },
                                {
                                    type: 'Parameter',
                                    loc: {
                                        start: {
                                            offset: 22,
                                            line: 1,
                                            column: 23,
                                        },
                                        end: {
                                            offset: 28,
                                            line: 1,
                                            column: 29,
                                        },
                                    },
                                    value: 'param1',
                                },
                            ],
                        },
                    },
                    {
                        type: 'Hint',
                        loc: {
                            start: {
                                offset: 30,
                                line: 1,
                                column: 31,
                            },
                            end: {
                                offset: 48,
                                line: 1,
                                column: 49,
                            },
                        },
                        name: {
                            type: 'Value',
                            loc: {
                                start: {
                                    offset: 30,
                                    line: 1,
                                    column: 31,
                                },
                                end: {
                                    offset: 40,
                                    line: 1,
                                    column: 41,
                                },
                            },
                            value: 'HINT_NAME2',
                        },
                        params: {
                            type: 'ParameterList',
                            loc: {
                                start: {
                                    offset: 41,
                                    line: 1,
                                    column: 42,
                                },
                                end: {
                                    offset: 47,
                                    line: 1,
                                    column: 48,
                                },
                            },
                            children: [
                                {
                                    type: 'Parameter',
                                    loc: {
                                        start: {
                                            offset: 41,
                                            line: 1,
                                            column: 42,
                                        },
                                        end: {
                                            offset: 47,
                                            line: 1,
                                            column: 48,
                                        },
                                    },
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
            loc: {
                start: {
                    offset: 0,
                    line: 1,
                    column: 1,
                },
                end: {
                    offset: 30,
                    line: 1,
                    column: 31,
                },
            },
            category: 'Comment',
            syntax: 'AdGuard',
            children: [
                {
                    type: 'Hint',
                    loc: {
                        start: {
                            offset: 3,
                            line: 1,
                            column: 4,
                        },
                        end: {
                            offset: 30,
                            line: 1,
                            column: 31,
                        },
                    },
                    name: {
                        type: 'Value',
                        loc: {
                            start: {
                                offset: 3,
                                line: 1,
                                column: 4,
                            },
                            end: {
                                offset: 12,
                                line: 1,
                                column: 13,
                            },
                        },
                        value: 'HINT_NAME',
                    },
                    params: {
                        type: 'ParameterList',
                        loc: {
                            start: {
                                offset: 13,
                                line: 1,
                                column: 14,
                            },
                            end: {
                                offset: 29,
                                line: 1,
                                column: 30,
                            },
                        },
                        children: [
                            {
                                type: 'Parameter',
                                loc: {
                                    start: {
                                        offset: 13,
                                        line: 1,
                                        column: 14,
                                    },
                                    end: {
                                        offset: 19,
                                        line: 1,
                                        column: 20,
                                    },
                                },
                                value: 'param0',
                            },
                            {
                                type: 'Parameter',
                                loc: {
                                    start: {
                                        offset: 21,
                                        line: 1,
                                        column: 22,
                                    },
                                    end: {
                                        offset: 20,
                                        line: 1,
                                        column: 21,
                                    },
                                },
                                value: ' ',
                            },
                            {
                                type: 'Parameter',
                                loc: {
                                    start: {
                                        offset: 23,
                                        line: 1,
                                        column: 24,
                                    },
                                    end: {
                                        offset: 29,
                                        line: 1,
                                        column: 30,
                                    },
                                },
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
                loc: {
                    start: {
                        offset: 0,
                        line: 1,
                        column: 1,
                    },
                    end: {
                        offset: 26,
                        line: 1,
                        column: 27,
                    },
                },
                category: 'Comment',
                syntax: 'AdGuard',
                children: [
                    {
                        type: 'Hint',
                        loc: {
                            start: {
                                offset: 3,
                                line: 1,
                                column: 4,
                            },
                            end: {
                                offset: 26,
                                line: 1,
                                column: 27,
                            },
                        },
                        name: {
                            type: 'Value',
                            loc: {
                                start: {
                                    offset: 3,
                                    line: 1,
                                    column: 4,
                                },
                                end: {
                                    offset: 12,
                                    line: 1,
                                    column: 13,
                                },
                            },
                            value: 'HINT_NAME',
                        },
                        params: {
                            type: 'ParameterList',
                            loc: {
                                start: {
                                    offset: 13,
                                    line: 1,
                                    column: 14,
                                },
                                end: {
                                    offset: 25,
                                    line: 1,
                                    column: 26,
                                },
                            },
                            children: [
                                {
                                    type: 'Parameter',
                                    loc: {
                                        start: {
                                            offset: 13,
                                            line: 1,
                                            column: 14,
                                        },
                                        end: {
                                            offset: 19,
                                            line: 1,
                                            column: 20,
                                        },
                                    },
                                    value: 'param0',
                                },
                                {
                                    type: 'Parameter',
                                    loc: {
                                        start: {
                                            offset: 21,
                                            line: 1,
                                            column: 22,
                                        },
                                        end: {
                                            offset: 20,
                                            line: 1,
                                            column: 21,
                                        },
                                    },
                                    value: ' ',
                                },
                                {
                                    type: 'Parameter',
                                    loc: {
                                        start: {
                                            offset: 23,
                                            line: 1,
                                            column: 24,
                                        },
                                        end: {
                                            offset: 22,
                                            line: 1,
                                            column: 23,
                                        },
                                    },
                                    value: ' ',
                                },
                                {
                                    type: 'Parameter',
                                    loc: {
                                        start: {
                                            offset: 25,
                                            line: 1,
                                            column: 26,
                                        },
                                        end: {
                                            offset: 24,
                                            line: 1,
                                            column: 25,
                                        },
                                    },
                                    value: ' ',
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
                category: 'Comment',
                syntax: 'AdGuard',
                children: [
                    {
                        type: 'Hint',
                        loc: {
                            start: {
                                offset: 3,
                                line: 1,
                                column: 4,
                            },
                            end: {
                                offset: 21,
                                line: 1,
                                column: 22,
                            },
                        },
                        name: {
                            type: 'Value',
                            loc: {
                                start: {
                                    offset: 3,
                                    line: 1,
                                    column: 4,
                                },
                                end: {
                                    offset: 12,
                                    line: 1,
                                    column: 13,
                                },
                            },
                            value: 'HINT_NAME',
                        },
                        params: {
                            type: 'ParameterList',
                            loc: {
                                start: {
                                    offset: 13,
                                    line: 1,
                                    column: 14,
                                },
                                end: {
                                    offset: 20,
                                    line: 1,
                                    column: 21,
                                },
                            },
                            children: [
                                {
                                    type: 'Parameter',
                                    loc: {
                                        start: {
                                            offset: 14,
                                            line: 1,
                                            column: 15,
                                        },
                                        end: {
                                            offset: 13,
                                            line: 1,
                                            column: 14,
                                        },
                                    },
                                    value: ' ',
                                },
                                {
                                    type: 'Parameter',
                                    loc: {
                                        start: {
                                            offset: 16,
                                            line: 1,
                                            column: 17,
                                        },
                                        end: {
                                            offset: 15,
                                            line: 1,
                                            column: 16,
                                        },
                                    },
                                    value: ' ',
                                },
                                {
                                    type: 'Parameter',
                                    loc: {
                                        start: {
                                            offset: 18,
                                            line: 1,
                                            column: 19,
                                        },
                                        end: {
                                            offset: 17,
                                            line: 1,
                                            column: 18,
                                        },
                                    },
                                    value: ' ',
                                },
                                {
                                    type: 'Parameter',
                                    loc: {
                                        start: {
                                            offset: 20,
                                            line: 1,
                                            column: 21,
                                        },
                                        end: {
                                            offset: 19,
                                            line: 1,
                                            column: 20,
                                        },
                                    },
                                    value: ' ',
                                },
                            ],
                        },
                    },
                ],
            },
        );

        expect(HintCommentRuleParser.parse('!+ HINT_NAME(,,,)')).toMatchObject({
            type: 'HintCommentRule',
            loc: {
                start: {
                    offset: 0,
                    line: 1,
                    column: 1,
                },
                end: {
                    offset: 17,
                    line: 1,
                    column: 18,
                },
            },
            category: 'Comment',
            syntax: 'AdGuard',
            children: [
                {
                    type: 'Hint',
                    loc: {
                        start: {
                            offset: 3,
                            line: 1,
                            column: 4,
                        },
                        end: {
                            offset: 17,
                            line: 1,
                            column: 18,
                        },
                    },
                    name: {
                        type: 'Value',
                        loc: {
                            start: {
                                offset: 3,
                                line: 1,
                                column: 4,
                            },
                            end: {
                                offset: 12,
                                line: 1,
                                column: 13,
                            },
                        },
                        value: 'HINT_NAME',
                    },
                    params: {
                        type: 'ParameterList',
                        loc: {
                            start: {
                                offset: 13,
                                line: 1,
                                column: 14,
                            },
                            end: {
                                offset: 16,
                                line: 1,
                                column: 17,
                            },
                        },
                        children: [
                            {
                                type: 'Parameter',
                                loc: {
                                    start: {
                                        offset: 13,
                                        line: 1,
                                        column: 14,
                                    },
                                    end: {
                                        offset: 13,
                                        line: 1,
                                        column: 14,
                                    },
                                },
                                value: '',
                            },
                            {
                                type: 'Parameter',
                                loc: {
                                    start: {
                                        offset: 14,
                                        line: 1,
                                        column: 15,
                                    },
                                    end: {
                                        offset: 14,
                                        line: 1,
                                        column: 15,
                                    },
                                },
                                value: '',
                            },
                            {
                                type: 'Parameter',
                                loc: {
                                    start: {
                                        offset: 15,
                                        line: 1,
                                        column: 16,
                                    },
                                    end: {
                                        offset: 15,
                                        line: 1,
                                        column: 16,
                                    },
                                },
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
            loc: {
                start: {
                    offset: 0,
                    line: 1,
                    column: 1,
                },
                end: {
                    offset: 44,
                    line: 1,
                    column: 45,
                },
            },
            category: 'Comment',
            syntax: 'AdGuard',
            children: [
                {
                    type: 'Hint',
                    loc: {
                        start: {
                            offset: 3,
                            line: 1,
                            column: 4,
                        },
                        end: {
                            offset: 44,
                            line: 1,
                            column: 45,
                        },
                    },
                    name: {
                        type: 'Value',
                        loc: {
                            start: {
                                offset: 3,
                                line: 1,
                                column: 4,
                            },
                            end: {
                                offset: 12,
                                line: 1,
                                column: 13,
                            },
                        },
                        value: 'HINT_NAME',
                    },
                    params: {
                        type: 'ParameterList',
                        loc: {
                            start: {
                                offset: 13,
                                line: 1,
                                column: 14,
                            },
                            end: {
                                offset: 43,
                                line: 1,
                                column: 44,
                            },
                        },
                        children: [
                            {
                                type: 'Parameter',
                                loc: {
                                    start: {
                                        offset: 17,
                                        line: 1,
                                        column: 18,
                                    },
                                    end: {
                                        offset: 19,
                                        line: 1,
                                        column: 20,
                                    },
                                },
                                value: 'p0',
                            },
                            {
                                type: 'Parameter',
                                loc: {
                                    start: {
                                        offset: 25,
                                        line: 1,
                                        column: 26,
                                    },
                                    end: {
                                        offset: 27,
                                        line: 1,
                                        column: 28,
                                    },
                                },
                                value: 'p1',
                            },
                            {
                                type: 'Parameter',
                                loc: {
                                    start: {
                                        offset: 32,
                                        line: 1,
                                        column: 33,
                                    },
                                    end: {
                                        offset: 34,
                                        line: 1,
                                        column: 35,
                                    },
                                },
                                value: 'p2',
                            },
                            {
                                type: 'Parameter',
                                loc: {
                                    start: {
                                        offset: 41,
                                        line: 1,
                                        column: 42,
                                    },
                                    end: {
                                        offset: 43,
                                        line: 1,
                                        column: 44,
                                    },
                                },
                                value: 'p3',
                            },
                        ],
                    },
                },
            ],
        });

        expect(HintCommentRuleParser.parse('!+ HINT_NAME(hello world, hello   world)')).toMatchObject({
            type: 'HintCommentRule',
            loc: {
                start: {
                    offset: 0,
                    line: 1,
                    column: 1,
                },
                end: {
                    offset: 40,
                    line: 1,
                    column: 41,
                },
            },
            category: 'Comment',
            syntax: 'AdGuard',
            children: [
                {
                    type: 'Hint',
                    loc: {
                        start: {
                            offset: 3,
                            line: 1,
                            column: 4,
                        },
                        end: {
                            offset: 40,
                            line: 1,
                            column: 41,
                        },
                    },
                    name: {
                        type: 'Value',
                        loc: {
                            start: {
                                offset: 3,
                                line: 1,
                                column: 4,
                            },
                            end: {
                                offset: 12,
                                line: 1,
                                column: 13,
                            },
                        },
                        value: 'HINT_NAME',
                    },
                    params: {
                        type: 'ParameterList',
                        loc: {
                            start: {
                                offset: 13,
                                line: 1,
                                column: 14,
                            },
                            end: {
                                offset: 39,
                                line: 1,
                                column: 40,
                            },
                        },
                        children: [
                            {
                                type: 'Parameter',
                                loc: {
                                    start: {
                                        offset: 13,
                                        line: 1,
                                        column: 14,
                                    },
                                    end: {
                                        offset: 24,
                                        line: 1,
                                        column: 25,
                                    },
                                },
                                value: 'hello world',
                            },
                            {
                                type: 'Parameter',
                                loc: {
                                    start: {
                                        offset: 26,
                                        line: 1,
                                        column: 27,
                                    },
                                    end: {
                                        offset: 39,
                                        line: 1,
                                        column: 40,
                                    },
                                },
                                value: 'hello   world',
                            },
                        ],
                    },
                },
            ],
        });

        expect(HintCommentRuleParser.parse('!+ hint_name(hello world, hello   world)')).toMatchObject({
            type: 'HintCommentRule',
            loc: {
                start: {
                    offset: 0,
                    line: 1,
                    column: 1,
                },
                end: {
                    offset: 40,
                    line: 1,
                    column: 41,
                },
            },
            category: 'Comment',
            syntax: 'AdGuard',
            children: [
                {
                    type: 'Hint',
                    loc: {
                        start: {
                            offset: 3,
                            line: 1,
                            column: 4,
                        },
                        end: {
                            offset: 40,
                            line: 1,
                            column: 41,
                        },
                    },
                    name: {
                        type: 'Value',
                        loc: {
                            start: {
                                offset: 3,
                                line: 1,
                                column: 4,
                            },
                            end: {
                                offset: 12,
                                line: 1,
                                column: 13,
                            },
                        },
                        value: 'hint_name',
                    },
                    params: {
                        type: 'ParameterList',
                        loc: {
                            start: {
                                offset: 13,
                                line: 1,
                                column: 14,
                            },
                            end: {
                                offset: 39,
                                line: 1,
                                column: 40,
                            },
                        },
                        children: [
                            {
                                type: 'Parameter',
                                loc: {
                                    start: {
                                        offset: 13,
                                        line: 1,
                                        column: 14,
                                    },
                                    end: {
                                        offset: 24,
                                        line: 1,
                                        column: 25,
                                    },
                                },
                                value: 'hello world',
                            },
                            {
                                type: 'Parameter',
                                loc: {
                                    start: {
                                        offset: 26,
                                        line: 1,
                                        column: 27,
                                    },
                                    end: {
                                        offset: 39,
                                        line: 1,
                                        column: 40,
                                    },
                                },
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

    test('generate', () => {
        const parseAndGenerate = (raw: string) => {
            const ast = HintCommentRuleParser.parse(raw);

            if (ast) {
                return HintCommentRuleParser.generate(ast);
            }

            return null;
        };

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
