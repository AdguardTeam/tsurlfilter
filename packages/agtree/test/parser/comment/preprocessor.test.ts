import { PreProcessorCommentRuleParser } from '../../../src/parser/comment/preprocessor';
import { EMPTY, SPACE } from '../../../src/utils/constants';

describe('PreProcessorParser', () => {
    test('isPreProcessorRule', () => {
        // TODO: Refactor to test.each
        // Invalid
        expect(PreProcessorCommentRuleParser.isPreProcessorRule(EMPTY)).toBeFalsy();
        expect(PreProcessorCommentRuleParser.isPreProcessorRule(SPACE)).toBeFalsy();

        expect(PreProcessorCommentRuleParser.isPreProcessorRule('!')).toBeFalsy();
        expect(PreProcessorCommentRuleParser.isPreProcessorRule('!##')).toBeFalsy();
        expect(PreProcessorCommentRuleParser.isPreProcessorRule('##')).toBeFalsy();
    });

    test('parse', () => {
        // TODO: Refactor to test.each
        // Valid pre-processors
        expect(PreProcessorCommentRuleParser.parse('!#endif')).toMatchObject({
            type: 'PreProcessorCommentRule',
            loc: {
                start: {
                    offset: 0,
                    line: 1,
                    column: 1,
                },
                end: {
                    offset: 7,
                    line: 1,
                    column: 8,
                },
            },
            category: 'Comment',
            syntax: 'Common',
            name: {
                type: 'Value',
                loc: {
                    start: {
                        offset: 2,
                        line: 1,
                        column: 3,
                    },
                    end: {
                        offset: 7,
                        line: 1,
                        column: 8,
                    },
                },
                value: 'endif',
            },
        });

        expect(PreProcessorCommentRuleParser.parse('!#include ../sections/ads.txt')).toMatchObject({
            type: 'PreProcessorCommentRule',
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
            category: 'Comment',
            syntax: 'Common',
            name: {
                type: 'Value',
                loc: {
                    start: {
                        offset: 2,
                        line: 1,
                        column: 3,
                    },
                    end: {
                        offset: 9,
                        line: 1,
                        column: 10,
                    },
                },
                value: 'include',
            },
            params: {
                type: 'Value',
                loc: {
                    start: {
                        offset: 10,
                        line: 1,
                        column: 11,
                    },
                    end: {
                        offset: 29,
                        line: 1,
                        column: 30,
                    },
                },
                value: '../sections/ads.txt',
            },
        });

        expect(PreProcessorCommentRuleParser.parse('!#if (adguard)')).toMatchObject({
            type: 'PreProcessorCommentRule',
            loc: {
                start: {
                    offset: 0,
                    line: 1,
                    column: 1,
                },
                end: {
                    offset: 14,
                    line: 1,
                    column: 15,
                },
            },
            category: 'Comment',
            syntax: 'Common',
            name: {
                type: 'Value',
                loc: {
                    start: {
                        offset: 2,
                        line: 1,
                        column: 3,
                    },
                    end: {
                        offset: 4,
                        line: 1,
                        column: 5,
                    },
                },
                value: 'if',
            },
            params: {
                type: 'Parenthesis',
                loc: {
                    start: {
                        offset: 6,
                        line: 1,
                        column: 7,
                    },
                    end: {
                        offset: 13,
                        line: 1,
                        column: 14,
                    },
                },
                expression: {
                    type: 'Variable',
                    loc: {
                        start: {
                            offset: 6,
                            line: 1,
                            column: 7,
                        },
                        end: {
                            offset: 13,
                            line: 1,
                            column: 14,
                        },
                    },
                    name: 'adguard',
                },
            },
        });

        expect(PreProcessorCommentRuleParser.parse('!#if      (adguard)')).toMatchObject({
            type: 'PreProcessorCommentRule',
            loc: {
                start: {
                    offset: 0,
                    line: 1,
                    column: 1,
                },
                end: {
                    offset: 19,
                    line: 1,
                    column: 20,
                },
            },
            category: 'Comment',
            syntax: 'Common',
            name: {
                type: 'Value',
                loc: {
                    start: {
                        offset: 2,
                        line: 1,
                        column: 3,
                    },
                    end: {
                        offset: 4,
                        line: 1,
                        column: 5,
                    },
                },
                value: 'if',
            },
            params: {
                type: 'Parenthesis',
                loc: {
                    start: {
                        offset: 11,
                        line: 1,
                        column: 12,
                    },
                    end: {
                        offset: 18,
                        line: 1,
                        column: 19,
                    },
                },
                expression: {
                    type: 'Variable',
                    loc: {
                        start: {
                            offset: 11,
                            line: 1,
                            column: 12,
                        },
                        end: {
                            offset: 18,
                            line: 1,
                            column: 19,
                        },
                    },
                    name: 'adguard',
                },
            },
        });

        expect(PreProcessorCommentRuleParser.parse('!#if      (adguard)')).toMatchObject({
            type: 'PreProcessorCommentRule',
            loc: {
                start: {
                    offset: 0,
                    line: 1,
                    column: 1,
                },
                end: {
                    offset: 19,
                    line: 1,
                    column: 20,
                },
            },
            category: 'Comment',
            syntax: 'Common',
            name: {
                type: 'Value',
                loc: {
                    start: {
                        offset: 2,
                        line: 1,
                        column: 3,
                    },
                    end: {
                        offset: 4,
                        line: 1,
                        column: 5,
                    },
                },
                value: 'if',
            },
            params: {
                type: 'Parenthesis',
                loc: {
                    start: {
                        offset: 11,
                        line: 1,
                        column: 12,
                    },
                    end: {
                        offset: 18,
                        line: 1,
                        column: 19,
                    },
                },
                expression: {
                    type: 'Variable',
                    loc: {
                        start: {
                            offset: 11,
                            line: 1,
                            column: 12,
                        },
                        end: {
                            offset: 18,
                            line: 1,
                            column: 19,
                        },
                    },
                    name: 'adguard',
                },
            },
        });

        expect(
            PreProcessorCommentRuleParser.parse('!#safari_cb_affinity(content_blockers)'),
        ).toMatchObject({
            type: 'PreProcessorCommentRule',
            loc: {
                start: {
                    offset: 0,
                    line: 1,
                    column: 1,
                },
                end: {
                    offset: 38,
                    line: 1,
                    column: 39,
                },
            },
            raws: {
                text: '!#safari_cb_affinity(content_blockers)',
            },
            category: 'Comment',
            syntax: 'AdGuard',
            name: {
                type: 'Value',
                loc: {
                    start: {
                        offset: 2,
                        line: 1,
                        column: 3,
                    },
                    end: {
                        offset: 20,
                        line: 1,
                        column: 21,
                    },
                },
                value: 'safari_cb_affinity',
            },
            params: {
                type: 'ParameterList',
                loc: {
                    start: {
                        offset: 21,
                        line: 1,
                        column: 22,
                    },
                    end: {
                        offset: 37,
                        line: 1,
                        column: 38,
                    },
                },
                children: [
                    {
                        type: 'Parameter',
                        loc: {
                            start: {
                                offset: 21,
                                line: 1,
                                column: 22,
                            },
                            end: {
                                offset: 37,
                                line: 1,
                                column: 38,
                            },
                        },
                        value: 'content_blockers',
                    },
                ],
            },
        });

        // If the parenthesis is open, do not split it in half along the space:
        expect(PreProcessorCommentRuleParser.parse('!#aaa(bbb ccc)')).toMatchObject({
            type: 'PreProcessorCommentRule',
            loc: {
                start: {
                    offset: 0,
                    line: 1,
                    column: 1,
                },
                end: {
                    offset: 14,
                    line: 1,
                    column: 15,
                },
            },
            category: 'Comment',
            syntax: 'Common',
            name: {
                type: 'Value',
                loc: {
                    start: {
                        offset: 2,
                        line: 1,
                        column: 3,
                    },
                    end: {
                        offset: 5,
                        line: 1,
                        column: 6,
                    },
                },
                value: 'aaa',
            },
            params: {
                type: 'Value',
                loc: {
                    start: {
                        offset: 5,
                        line: 1,
                        column: 6,
                    },
                    end: {
                        offset: 14,
                        line: 1,
                        column: 15,
                    },
                },
                value: '(bbb ccc)',
            },
        });

        // Invalid
        expect(() => PreProcessorCommentRuleParser.parse('!#include    ')).toThrowError(
            'Directive "include" requires parameters',
        );

        expect(() => PreProcessorCommentRuleParser.parse('!#safari_cb_affinity (a)')).toThrowError(
            'Unexpected whitespace after "safari_cb_affinity" directive name',
        );
    });

    describe('parser options should work as expected', () => {
        // TODO: Add template for test.each
        test.each([
            {
                actual: '!#safari_cb_affinity(content_blockers)',
                expected: {
                    type: 'PreProcessorCommentRule',
                    raws: {
                        text: '!#safari_cb_affinity(content_blockers)',
                    },
                    category: 'Comment',
                    syntax: 'AdGuard',
                    name: {
                        type: 'Value',
                        value: 'safari_cb_affinity',
                    },
                    params: {
                        type: 'ParameterList',
                        children: [
                            {
                                type: 'Parameter',
                                value: 'content_blockers',
                            },
                        ],
                    },
                },
            },
        ])('isLocIncluded should work for $actual', ({ actual, expected }) => {
            expect(PreProcessorCommentRuleParser.parse(actual, { isLocIncluded: false })).toEqual(expected);
        });
    });

    test('generate', () => {
        const parseAndGenerate = (raw: string) => {
            const ast = PreProcessorCommentRuleParser.parse(raw);

            if (ast) {
                return PreProcessorCommentRuleParser.generate(ast);
            }

            return null;
        };

        // TODO: Refactor to test.each
        expect(parseAndGenerate('!#endif')).toEqual('!#endif');

        expect(parseAndGenerate('!#include ../sections/ads.txt')).toEqual('!#include ../sections/ads.txt');

        expect(parseAndGenerate('!#safari_cb_affinity(content_blockers)')).toEqual(
            '!#safari_cb_affinity(content_blockers)',
        );

        expect(parseAndGenerate('!#if adguard')).toEqual(
            '!#if adguard',
        );

        expect(parseAndGenerate('!#if (adguard)')).toEqual(
            '!#if (adguard)',
        );

        expect(parseAndGenerate('!#if (adguard && !adguard_ext_safari)')).toEqual(
            '!#if (adguard && !adguard_ext_safari)',
        );
    });
});
