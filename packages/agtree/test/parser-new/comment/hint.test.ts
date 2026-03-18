import { describe, expect, test } from 'vitest';

import { CommentRuleParser } from '../../../src/parser-new/comment/comment-rule-parser';

const parser = new CommentRuleParser();

describe('CommentRuleParser — hint comments', () => {
    describe('parse (with location)', () => {
        test('!+NOT_OPTIMIZED — no space, no params', () => {
            expect(parser.parse('!+NOT_OPTIMIZED', { isLocIncluded: true })).toMatchObject({
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
        });

        test('!+ NOT_OPTIMIZED — space after marker', () => {
            expect(parser.parse('!+ NOT_OPTIMIZED', { isLocIncluded: true })).toMatchObject({
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
        });

        test('!+ HINT_NAME1 HINT_NAME2 — two hints without params', () => {
            expect(parser.parse('!+ HINT_NAME1 HINT_NAME2', { isLocIncluded: true })).toMatchObject({
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
        });

        test('!+ HINT_NAME1() — empty param list', () => {
            expect(parser.parse('!+ HINT_NAME1()', { isLocIncluded: true })).toMatchObject({
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
                            children: [],
                        },
                    },
                ],
            });
        });

        test('!+ HINT_NAME1(param0, param1) — one hint with two params', () => {
            expect(parser.parse('!+ HINT_NAME1(param0, param1)', { isLocIncluded: true })).toMatchObject({
                type: 'HintCommentRule',
                start: 0,
                end: 29,
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
                ],
            });
        });

        test('!+ HINT_NAME1(param0, param1) HINT_NAME2(param0) — two hints with params', () => {
            expect(
                parser.parse('!+ HINT_NAME1(param0, param1) HINT_NAME2(param0)', { isLocIncluded: true }),
            ).toMatchObject({
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
                                    type: 'Value',
                                    value: 'param0',
                                },
                            ],
                        },
                    },
                ],
            });
        });

        test('!+ HINT_NAME(param0, , param1) — skipped parameter is null', () => {
            expect(parser.parse('!+ HINT_NAME(param0, , param1)', { isLocIncluded: true })).toMatchObject({
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
                                    type: 'Value',
                                    value: 'param0',
                                },
                                null,
                                {
                                    type: 'Value',
                                    value: 'param1',
                                },
                            ],
                        },
                    },
                ],
            });
        });

        test('!+ HINT_NAME(,,,) — all-null parameter list', () => {
            expect(parser.parse('!+ HINT_NAME(,,,)', { isLocIncluded: true })).toMatchObject({
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
            expect(parser.parse('!+ NOT_OPTIMIZED')).toEqual({
                type: 'HintCommentRule',
                category: 'Comment',
                syntax: 'AdGuard',
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

        test('includeRaws adds raws.text', () => {
            const source = '!+ NOT_OPTIMIZED PLATFORM(windows)';
            const result = parser.parse(source, { includeRaws: true });
            expect(result.raws).toEqual({ text: source });
        });
    });

    describe('edge cases', () => {
        test('!+ — no hints produces 0 children (no throw)', () => {
            const result = parser.parse('!+');
            expect(result).toMatchObject({
                type: 'HintCommentRule',
                children: [],
            });
        });
    });
});
