import { describe, expect, test } from 'vitest';

import { parseCommentRule } from '../../helpers/parse-helpers';

describe('CommentAstBuilder — preprocessor comments', () => {
    describe('parse (with location)', () => {
        test('!#endif — no params', () => {
            expect(parseCommentRule('!#endif', { isLocIncluded: true })).toMatchObject({
                type: 'PreProcessorCommentRule',
                start: 0,
                end: 7,
                category: 'Comment',
                syntax: 'AdGuard',
                name: {
                    type: 'Value',
                    start: 2,
                    end: 7,
                    value: 'endif',
                },
            });
        });

        test('!#include ../sections/ads.txt — path as raw Value', () => {
            expect(parseCommentRule('!#include ../sections/ads.txt', { isLocIncluded: true })).toMatchObject({
                type: 'PreProcessorCommentRule',
                start: 0,
                end: 29,
                category: 'Comment',
                syntax: 'AdGuard',
                name: {
                    type: 'Value',
                    start: 2,
                    end: 9,
                    value: 'include',
                },
                params: {
                    type: 'Value',
                    start: 10,
                    end: 29,
                    value: '../sections/ads.txt',
                },
            });
        });

        test('!#if (adguard) — condition parsed as Parenthesis expression node', () => {
            expect(parseCommentRule('!#if (adguard)', { isLocIncluded: true })).toMatchObject({
                type: 'PreProcessorCommentRule',
                start: 0,
                end: 14,
                category: 'Comment',
                syntax: 'AdGuard',
                name: {
                    type: 'Value',
                    start: 2,
                    end: 4,
                    value: 'if',
                },
                params: {
                    type: 'Parenthesis',
                    start: 6,
                    end: 13,
                    expression: {
                        type: 'Variable',
                        start: 6,
                        end: 13,
                        name: 'adguard',
                    },
                },
            });
        });

        test('!#if      (adguard) — leading spaces before params, expression node', () => {
            expect(parseCommentRule('!#if      (adguard)', { isLocIncluded: true })).toMatchObject({
                type: 'PreProcessorCommentRule',
                start: 0,
                end: 19,
                category: 'Comment',
                syntax: 'AdGuard',
                name: {
                    type: 'Value',
                    start: 2,
                    end: 4,
                    value: 'if',
                },
                params: {
                    type: 'Parenthesis',
                    start: 11,
                    end: 18,
                    expression: {
                        type: 'Variable',
                        start: 11,
                        end: 18,
                        name: 'adguard',
                    },
                },
            });
        });

        test('!#if adguard — bare identifier parsed as Variable expression node', () => {
            expect(parseCommentRule('!#if adguard', { isLocIncluded: true })).toMatchObject({
                type: 'PreProcessorCommentRule',
                start: 0,
                end: 12,
                category: 'Comment',
                syntax: 'AdGuard',
                name: {
                    type: 'Value',
                    start: 2,
                    end: 4,
                    value: 'if',
                },
                params: {
                    type: 'Variable',
                    start: 5,
                    end: 12,
                    name: 'adguard',
                },
            });
        });

        test('!#safari_cb_affinity(content_blockers) — params parsed as ParameterList', () => {
            expect(
                parseCommentRule('!#safari_cb_affinity(content_blockers)', { isLocIncluded: true }),
            ).toMatchObject({
                type: 'PreProcessorCommentRule',
                start: 0,
                end: 38,
                category: 'Comment',
                syntax: 'AdGuard',
                name: {
                    type: 'Value',
                    start: 2,
                    end: 20,
                    value: 'safari_cb_affinity',
                },
                params: {
                    type: 'ParameterList',
                    start: 21,
                    end: 37,
                    children: [
                        {
                            type: 'Parameter',
                            start: 21,
                            end: 37,
                            value: 'content_blockers',
                        },
                    ],
                },
            });
        });
    });

    describe('parse (without location)', () => {
        test('!#endif — no loc, no raws by default', () => {
            expect(parseCommentRule('!#endif')).toEqual({
                type: 'PreProcessorCommentRule',
                category: 'Comment',
                syntax: 'AdGuard',
                name: {
                    type: 'Value',
                    value: 'endif',
                },
            });
        });

        test('!#include ../sections/ads.txt — no location', () => {
            expect(parseCommentRule('!#include ../sections/ads.txt')).toEqual({
                type: 'PreProcessorCommentRule',
                category: 'Comment',
                syntax: 'AdGuard',
                name: {
                    type: 'Value',
                    value: 'include',
                },
                params: {
                    type: 'Value',
                    value: '../sections/ads.txt',
                },
            });
        });

        test('includeRaws adds raws.text', () => {
            const source = '!#safari_cb_affinity(content_blockers)';
            const result = parseCommentRule(source, { includeRaws: true });
            expect(result.raws).toEqual({ text: source });
        });
    });

    describe('!#if — logical expression integration', () => {
        test('!#if adguard && !adguard_ext_safari — AND with NOT', () => {
            expect(parseCommentRule('!#if adguard && !adguard_ext_safari', { isLocIncluded: true })).toMatchObject({
                type: 'PreProcessorCommentRule',
                params: {
                    type: 'Operator',
                    operator: '&&',
                    left: {
                        type: 'Variable',
                        name: 'adguard',
                    },
                    right: {
                        type: 'Operator',
                        operator: '!',
                        left: {
                            type: 'Variable',
                            name: 'adguard_ext_safari',
                        },
                    },
                },
            });
        });

        test('!#if adguard || adguard_ext_android — OR expression', () => {
            expect(parseCommentRule('!#if adguard || adguard_ext_android', { isLocIncluded: true })).toMatchObject({
                type: 'PreProcessorCommentRule',
                params: {
                    type: 'Operator',
                    operator: '||',
                    left: { type: 'Variable', name: 'adguard' },
                    right: { type: 'Variable', name: 'adguard_ext_android' },
                },
            });
        });

        // eslint-disable-next-line max-len
        test('!#if (adguard && !adguard_ext_safari) && (adguard_ext_android || adguard_ext_chromium) — complex', () => {
            expect(
                // eslint-disable-next-line max-len
                parseCommentRule('!#if (adguard && !adguard_ext_safari) && (adguard_ext_android || adguard_ext_chromium)'),
            ).toMatchObject({
                type: 'PreProcessorCommentRule',
                params: {
                    type: 'Operator',
                    operator: '&&',
                    left: {
                        type: 'Parenthesis',
                        expression: {
                            type: 'Operator',
                            operator: '&&',
                            left: { type: 'Variable', name: 'adguard' },
                            right: {
                                type: 'Operator',
                                operator: '!',
                                left: { type: 'Variable', name: 'adguard_ext_safari' },
                            },
                        },
                    },
                    right: {
                        type: 'Parenthesis',
                        expression: {
                            type: 'Operator',
                            operator: '||',
                            left: { type: 'Variable', name: 'adguard_ext_android' },
                            right: { type: 'Variable', name: 'adguard_ext_chromium' },
                        },
                    },
                },
            });
        });

        test('!#if !adguard — NOT expression without location', () => {
            expect(parseCommentRule('!#if !adguard')).toMatchObject({
                type: 'PreProcessorCommentRule',
                params: {
                    type: 'Operator',
                    operator: '!',
                    left: { type: 'Variable', name: 'adguard' },
                },
            });
        });

        test('non-if directives still get Value params (not parsed as expression)', () => {
            expect(parseCommentRule('!#include adguard || other')).toMatchObject({
                type: 'PreProcessorCommentRule',
                params: {
                    type: 'Value',
                    value: 'adguard || other',
                },
            });
        });
    });
});
