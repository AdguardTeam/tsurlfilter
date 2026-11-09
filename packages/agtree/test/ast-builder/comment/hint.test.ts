import { describe, expect, test } from 'vitest';

import { RuleParserPipeline } from '../../../src/ast-builder/rule-parser';
import type { HintCommentRule } from '../../../src/nodes';
import { QuoteType } from '../../../src/utils/quotes';
import { SYNTAX_ADG } from '../../../src/utils/syntax-flags';
import { parseCommentRule } from '../../helpers/parse-helpers';

describe('CommentAstBuilder — hint comments', () => {
    describe('parse (with location)', () => {
        test('!+NOT_OPTIMIZED — no space, no params', () => {
            expect(parseCommentRule('!+NOT_OPTIMIZED', { isLocIncluded: true })).toMatchObject({
                type: 'HintCommentRule',
                start: 0,
                end: 15,
                category: 'Comment',
                syntax: SYNTAX_ADG,
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
        });

        test('!+ NOT_OPTIMIZED — space after marker', () => {
            expect(parseCommentRule('!+ NOT_OPTIMIZED', { isLocIncluded: true })).toMatchObject({
                type: 'HintCommentRule',
                start: 0,
                end: 16,
                category: 'Comment',
                syntax: SYNTAX_ADG,
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
        });

        test('!+ HINT_NAME1 HINT_NAME2 — two hints without params', () => {
            expect(parseCommentRule('!+ HINT_NAME1 HINT_NAME2', { isLocIncluded: true })).toMatchObject({
                type: 'HintCommentRule',
                start: 0,
                end: 24,
                category: 'Comment',
                syntax: SYNTAX_ADG,
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
        });

        test('!+ HINT_NAME1() — empty param list', () => {
            expect(parseCommentRule('!+ HINT_NAME1()', { isLocIncluded: true })).toMatchObject({
                type: 'HintCommentRule',
                start: 0,
                end: 15,
                category: 'Comment',
                syntax: SYNTAX_ADG,
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
                            children: [],
                        },
                    },
                ],
            });
        });

        test('!+ HINT_NAME1(param0, param1) — one hint with two params', () => {
            expect(parseCommentRule('!+ HINT_NAME1(param0, param1)', { isLocIncluded: true })).toMatchObject({
                type: 'HintCommentRule',
                start: 0,
                end: 29,
                category: 'Comment',
                syntax: SYNTAX_ADG,
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
                            children: [
                                {
                                    type: 'Parameter',
                                    quoteType: QuoteType.None,
                                    value: 'param0',
                                },
                                {
                                    type: 'Parameter',
                                    quoteType: QuoteType.None,
                                    value: 'param1',
                                },
                            ],
                        },
                    },
                ],
            });
        });

        test('!+ HINT_NAME1(param0, param1) HINT_NAME2(param0) — two hints with params', () => {
            expect(
                parseCommentRule('!+ HINT_NAME1(param0, param1) HINT_NAME2(param0)', { isLocIncluded: true }),
            ).toMatchObject({
                type: 'HintCommentRule',
                start: 0,
                end: 48,
                category: 'Comment',
                syntax: SYNTAX_ADG,
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
                            children: [
                                {
                                    type: 'Parameter',
                                    quoteType: QuoteType.None,
                                    value: 'param0',
                                },
                                {
                                    type: 'Parameter',
                                    quoteType: QuoteType.None,
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
                            children: [
                                {
                                    type: 'Parameter',
                                    quoteType: QuoteType.None,
                                    value: 'param0',
                                },
                            ],
                        },
                    },
                ],
            });
        });

        test('!+ HINT_NAME(param0, , param1) — skipped parameter is null', () => {
            expect(parseCommentRule('!+ HINT_NAME(param0, , param1)', { isLocIncluded: true })).toMatchObject({
                type: 'HintCommentRule',
                children: [
                    {
                        type: 'Hint',
                        name: {
                            type: 'Value',
                            value: 'HINT_NAME',
                        },
                        params: {
                            type: 'ParameterList',
                            children: [
                                {
                                    type: 'Parameter',
                                    quoteType: QuoteType.None,
                                    value: 'param0',
                                },
                                null,
                                {
                                    type: 'Parameter',
                                    quoteType: QuoteType.None,
                                    value: 'param1',
                                },
                            ],
                        },
                    },
                ],
            });
        });

        test('!+ HINT_NAME(,,,) — all-null parameter list', () => {
            expect(parseCommentRule('!+ HINT_NAME(,,,)', { isLocIncluded: true })).toMatchObject({
                type: 'HintCommentRule',
                children: [
                    {
                        type: 'Hint',
                        params: {
                            type: 'ParameterList',
                            children: [null, null, null, null],
                        },
                    },
                ],
            });
        });
    });

    describe('parse (without location)', () => {
        test('!+ NOT_OPTIMIZED — no loc, no raws by default', () => {
            expect(parseCommentRule('!+ NOT_OPTIMIZED')).toEqual({
                type: 'HintCommentRule',
                category: 'Comment',
                syntax: SYNTAX_ADG,
                children: [
                    {
                        type: 'Hint',
                        name: {
                            type: 'Value',
                            value: 'NOT_OPTIMIZED',
                        },
                    },
                ],
            });
        });
    });

    describe('edge cases', () => {
        test('!+ — no hints produces 0 children (no throw)', () => {
            const result = parseCommentRule('!+');
            expect(result).toMatchObject({
                type: 'HintCommentRule',
                children: [],
            });
        });
    });
});

describe('CommentAstBuilder — hint capacity (F-006)', () => {
    // Use the production pipeline: its default context is the buffer the
    // capacity constants are sized for (the `parseCommentRule` helper builds a
    // deliberately smaller context).
    const pipeline = new RuleParserPipeline();

    /**
     * Builds a hint comment with `count` space-separated hints `H0…Hn`.
     *
     * @param count Number of hints.
     *
     * @returns Hint comment source.
     */
    const buildHints = (count: number): string => `!+ ${Array.from({ length: count }, (_, i) => `H${i}`).join(' ')}`;

    test('three hints keep their order and names', () => {
        const ast = pipeline.parse(buildHints(3)) as HintCommentRule;

        expect(ast.children).toHaveLength(3);
        expect(ast.children.map((hint) => hint.name.value)).toEqual(['H0', 'H1', 'H2']);
    });

    test('a hint list at capacity parses', () => {
        const ast = pipeline.parse(buildHints(240)) as HintCommentRule;

        expect(ast.children).toHaveLength(240);
        expect(ast.children[239].name.value).toBe('H239');
    });

    test('a hint list over capacity throws a capacity error instead of corrupting names', () => {
        expect(() => pipeline.parse(buildHints(241))).toThrow(/maximum of 240 hints/i);
    });

    test('a very long hint list throws instead of amplifying memory', () => {
        expect(() => pipeline.parse(buildHints(3000))).toThrow(/maximum of 240 hints/i);
    });

    test('every hint name equals its token span', () => {
        const source = buildHints(240);
        const ast = pipeline.parse(source, { isLocIncluded: true }) as HintCommentRule;

        for (const [i, hint] of ast.children.entries()) {
            expect(hint.name.value).toBe(`H${i}`);
            expect(source.slice(hint.name.start, hint.name.end)).toBe(hint.name.value);
        }
    });
});
