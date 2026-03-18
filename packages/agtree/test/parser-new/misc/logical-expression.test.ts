import { describe, expect, test } from 'vitest';

import { LogicalExpressionAstParser } from '../../../src/parser-new/misc/logical-expression';
import {
    createPreparserContext,
    initPreparserContext,
    LE_BUFFER_SIZE,
    LogicalExpressionPreparser,
} from '../../../src/preparser';
import { tokenizeLine } from '../../../src/tokenizer/tokenizer';
import type { TokenizeResult } from '../../../src/tokenizer/tokenizer';

const tokenResult: TokenizeResult = {
    tokenCount: 0,
    types: new Uint8Array(1024),
    ends: new Uint32Array(1024),
    actualEnd: 0,
    overflowed: 0,
};

const ctx = createPreparserContext();
const buf = new Int32Array(LE_BUFFER_SIZE);

/**
 * Tokenize, preparse, and build an AST for the given logical expression.
 *
 * @param source Logical expression source string.
 * @param isLocIncluded Whether to include source offsets in AST nodes.
 *
 * @returns Root `AnyExpressionNode`.
 */
function parse(source: string, isLocIncluded = false) {
    tokenizeLine(source, 0, tokenResult);
    initPreparserContext(ctx, source, tokenResult);
    LogicalExpressionPreparser.preparse(ctx, 0, tokenResult.tokenCount, buf);
    return LogicalExpressionAstParser.parse(source, buf, isLocIncluded);
}

describe('LogicalExpressionAstParser', () => {
    describe('single variable', () => {
        test('adguard — without location', () => {
            expect(parse('adguard')).toEqual({
                type: 'Variable',
                name: 'adguard',
            });
        });

        test('adguard — with location', () => {
            expect(parse('adguard', true)).toEqual({
                type: 'Variable',
                name: 'adguard',
                start: 0,
                end: 7,
            });
        });

        test('adguard_ext_safari — underscore in name', () => {
            expect(parse('adguard_ext_safari')).toEqual({
                type: 'Variable',
                name: 'adguard_ext_safari',
            });
        });
    });

    describe('NOT operator', () => {
        test('!adguard — without location', () => {
            expect(parse('!adguard')).toEqual({
                type: 'Operator',
                operator: '!',
                left: {
                    type: 'Variable',
                    name: 'adguard',
                },
            });
        });

        test('!adguard — with location', () => {
            expect(parse('!adguard', true)).toMatchObject({
                type: 'Operator',
                operator: '!',
                start: 0,
                end: 8,
                left: {
                    type: 'Variable',
                    start: 1,
                    end: 8,
                },
            });
        });
    });

    describe('AND operator', () => {
        test('adguard && adguard_ext_safari — without location', () => {
            expect(parse('adguard && adguard_ext_safari')).toEqual({
                type: 'Operator',
                operator: '&&',
                left: { type: 'Variable', name: 'adguard' },
                right: { type: 'Variable', name: 'adguard_ext_safari' },
            });
        });

        test('adguard && adguard_ext_safari — with location', () => {
            const source = 'adguard && adguard_ext_safari';
            expect(parse(source, true)).toMatchObject({
                type: 'Operator',
                operator: '&&',
                start: 0,
                end: source.length,
                left: { type: 'Variable', start: 0, end: 7 },
                right: { type: 'Variable', start: 11, end: source.length },
            });
        });
    });

    describe('OR operator', () => {
        test('adguard || adguard_ext_safari', () => {
            expect(parse('adguard || adguard_ext_safari')).toEqual({
                type: 'Operator',
                operator: '||',
                left: { type: 'Variable', name: 'adguard' },
                right: { type: 'Variable', name: 'adguard_ext_safari' },
            });
        });
    });

    describe('parentheses', () => {
        test('(adguard) — without location', () => {
            expect(parse('(adguard)')).toEqual({
                type: 'Parenthesis',
                expression: { type: 'Variable', name: 'adguard' },
            });
        });

        test('(adguard_ext_android_cb || adguard_ext_safari) — with location', () => {
            const source = '(adguard_ext_android_cb || adguard_ext_safari)';
            expect(parse(source, true)).toMatchObject({
                type: 'Parenthesis',
                expression: {
                    type: 'Operator',
                    operator: '||',
                    left: { type: 'Variable', name: 'adguard_ext_android_cb' },
                    right: { type: 'Variable', name: 'adguard_ext_safari' },
                },
            });
        });
    });

    describe('operator precedence', () => {
        test('a || b && c — AND binds tighter', () => {
            expect(parse('a || b && c')).toMatchObject({
                type: 'Operator',
                operator: '||',
                left: { type: 'Variable', name: 'a' },
                right: {
                    type: 'Operator',
                    operator: '&&',
                    left: { type: 'Variable', name: 'b' },
                    right: { type: 'Variable', name: 'c' },
                },
            });
        });

        test('a && b || c — left-associative at lower precedence', () => {
            expect(parse('a && b || c')).toMatchObject({
                type: 'Operator',
                operator: '||',
                left: {
                    type: 'Operator',
                    operator: '&&',
                    left: { type: 'Variable', name: 'a' },
                    right: { type: 'Variable', name: 'b' },
                },
                right: { type: 'Variable', name: 'c' },
            });
        });

        test('!a && b — NOT binds tighter than AND', () => {
            expect(parse('!a && b')).toMatchObject({
                type: 'Operator',
                operator: '&&',
                left: {
                    type: 'Operator',
                    operator: '!',
                    left: { type: 'Variable', name: 'a' },
                },
                right: { type: 'Variable', name: 'b' },
            });
        });
    });

    describe('complex real-world expressions', () => {
        test('(adguard_ext_android_cb || adguard_ext_safari) && !adguard_ext_chromium', () => {
            expect(parse('(adguard_ext_android_cb || adguard_ext_safari) && !adguard_ext_chromium')).toMatchObject({
                type: 'Operator',
                operator: '&&',
                left: {
                    type: 'Parenthesis',
                    expression: {
                        type: 'Operator',
                        operator: '||',
                        left: { type: 'Variable', name: 'adguard_ext_android_cb' },
                        right: { type: 'Variable', name: 'adguard_ext_safari' },
                    },
                },
                right: {
                    type: 'Operator',
                    operator: '!',
                    left: { type: 'Variable', name: 'adguard_ext_chromium' },
                },
            });
        });

        test('adguard — bare variable (no parentheses) as used in !#if adguard', () => {
            expect(parse('adguard')).toEqual({
                type: 'Variable',
                name: 'adguard',
            });
        });
    });
});
