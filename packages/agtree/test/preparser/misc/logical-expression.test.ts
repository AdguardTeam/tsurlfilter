import { describe, test, expect } from 'vitest';

import { tokenizeLine } from '../../../src/tokenizer/tokenizer';
import type { TokenizeResult } from '../../../src/tokenizer/tokenizer';
import type { AnyExpressionNode } from '../../../src/nodes';
import { LogicalExpressionAstParser } from '../../../src/parser-new/misc/logical-expression';
import { LogicalExpressionGenerator } from '../../../src/generator/misc/logical-expression-generator';
import {
    createPreparserContext,
    initPreparserContext,
    LogicalExpressionPreparser,
    LE_BUFFER_SIZE,
    LE_KIND_VAR,
    LE_KIND_NOT,
    LE_KIND_AND,
    LE_KIND_OR,
    LE_KIND_PAR,
} from '../../../src/preparser';

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
 * Tokenize + preparse a logical expression in one step for convenience.
 *
 * @param source Source string containing the expression.
 * @param startOffset Source start offset (default 0).
 * @returns Output buffer with the flat node-tree.
 */
function preparse(source: string, startOffset = 0): Int32Array {
    tokenizeLine(source, startOffset, tokenResult);
    initPreparserContext(ctx, source, tokenResult, startOffset);
    LogicalExpressionPreparser.preparse(ctx, 0, tokenResult.tokenCount, buf);
    return buf;
}

/**
 * Full pipeline: tokenize → preparse → build AST.
 *
 * @param source Logical expression source string.
 * @param isLocIncluded Whether to include source offsets in AST nodes.
 * @returns Root `AnyExpressionNode`.
 */
function parseAst(source: string, isLocIncluded = true): AnyExpressionNode {
    preparse(source);
    return LogicalExpressionAstParser.parse(source, buf, isLocIncluded);
}

/**
 * Full pipeline: tokenize → preparse → build AST → generate.
 *
 * @param source Logical expression source string.
 * @returns Generated string representation.
 */
function parseAndGenerate(source: string): string {
    return LogicalExpressionGenerator.generate(parseAst(source));
}

describe('LogicalExpressionPreparser', () => {
    describe('single variable', () => {
        test('adguard', () => {
            const b = preparse('adguard');
            expect(LogicalExpressionPreparser.rootIndex(b)).toBe(0);
            expect(LogicalExpressionPreparser.nodeCount(b)).toBe(1);
            expect(LogicalExpressionPreparser.nodeKind(b, 0)).toBe(LE_KIND_VAR);
            expect(LogicalExpressionPreparser.nodeSrcStart(b, 0)).toBe(0);
            expect(LogicalExpressionPreparser.nodeSrcEnd(b, 0)).toBe(7);
        });

        test('adguard_ext_safari', () => {
            const source = 'adguard_ext_safari';
            const b = preparse(source);
            expect(LogicalExpressionPreparser.nodeKind(b, 0)).toBe(LE_KIND_VAR);
            expect(LogicalExpressionPreparser.nodeSrcStart(b, 0)).toBe(0);
            expect(LogicalExpressionPreparser.nodeSrcEnd(b, 0)).toBe(source.length);
        });

        test('adguard-ext-safari — hyphens part of ident token', () => {
            const source = 'adguard-ext-safari';
            const b = preparse(source);
            expect(LogicalExpressionPreparser.nodeKind(b, 0)).toBe(LE_KIND_VAR);
            expect(source.slice(
                LogicalExpressionPreparser.nodeSrcStart(b, 0),
                LogicalExpressionPreparser.nodeSrcEnd(b, 0),
            )).toBe('adguard-ext-safari');
        });
    });

    describe('NOT operator', () => {
        test('!adguard', () => {
            const source = '!adguard';
            const b = preparse(source);
            expect(LogicalExpressionPreparser.nodeCount(b)).toBe(2);
            const root = LogicalExpressionPreparser.rootIndex(b);
            expect(LogicalExpressionPreparser.nodeKind(b, root)).toBe(LE_KIND_NOT);
            expect(LogicalExpressionPreparser.nodeSrcStart(b, root)).toBe(0);
            expect(LogicalExpressionPreparser.nodeSrcEnd(b, root)).toBe(source.length);
            const child = LogicalExpressionPreparser.nodeLeft(b, root);
            expect(LogicalExpressionPreparser.nodeKind(b, child)).toBe(LE_KIND_VAR);
            expect(LogicalExpressionPreparser.nodeSrcStart(b, child)).toBe(1);
        });

        test('! adguard — space between ! and variable', () => {
            const source = '! adguard';
            const b = preparse(source);
            const root = LogicalExpressionPreparser.rootIndex(b);
            expect(LogicalExpressionPreparser.nodeKind(b, root)).toBe(LE_KIND_NOT);
            expect(LogicalExpressionPreparser.nodeSrcStart(b, root)).toBe(0);
        });
    });

    describe('AND operator', () => {
        test('adguard && adguard_ext_safari', () => {
            const source = 'adguard && adguard_ext_safari';
            const b = preparse(source);
            const root = LogicalExpressionPreparser.rootIndex(b);
            expect(LogicalExpressionPreparser.nodeKind(b, root)).toBe(LE_KIND_AND);
            expect(LogicalExpressionPreparser.nodeSrcStart(b, root)).toBe(0);
            expect(LogicalExpressionPreparser.nodeSrcEnd(b, root)).toBe(source.length);

            const left = LogicalExpressionPreparser.nodeLeft(b, root);
            expect(LogicalExpressionPreparser.nodeKind(b, left)).toBe(LE_KIND_VAR);
            expect(source.slice(
                LogicalExpressionPreparser.nodeSrcStart(b, left),
                LogicalExpressionPreparser.nodeSrcEnd(b, left),
            )).toBe('adguard');

            const right = LogicalExpressionPreparser.nodeRight(b, root);
            expect(LogicalExpressionPreparser.nodeKind(b, right)).toBe(LE_KIND_VAR);
            expect(source.slice(
                LogicalExpressionPreparser.nodeSrcStart(b, right),
                LogicalExpressionPreparser.nodeSrcEnd(b, right),
            )).toBe('adguard_ext_safari');
        });
    });

    describe('OR operator', () => {
        test('adguard || adguard_ext_safari', () => {
            const source = 'adguard || adguard_ext_safari';
            const b = preparse(source);
            const root = LogicalExpressionPreparser.rootIndex(b);
            expect(LogicalExpressionPreparser.nodeKind(b, root)).toBe(LE_KIND_OR);

            const left = LogicalExpressionPreparser.nodeLeft(b, root);
            expect(source.slice(
                LogicalExpressionPreparser.nodeSrcStart(b, left),
                LogicalExpressionPreparser.nodeSrcEnd(b, left),
            )).toBe('adguard');

            const right = LogicalExpressionPreparser.nodeRight(b, root);
            expect(source.slice(
                LogicalExpressionPreparser.nodeSrcStart(b, right),
                LogicalExpressionPreparser.nodeSrcEnd(b, right),
            )).toBe('adguard_ext_safari');
        });
    });

    describe('parentheses', () => {
        test('(adguard)', () => {
            const source = '(adguard)';
            const b = preparse(source);
            const root = LogicalExpressionPreparser.rootIndex(b);
            expect(LogicalExpressionPreparser.nodeKind(b, root)).toBe(LE_KIND_PAR);
            const inner = LogicalExpressionPreparser.nodeLeft(b, root);
            expect(LogicalExpressionPreparser.nodeKind(b, inner)).toBe(LE_KIND_VAR);
            expect(source.slice(
                LogicalExpressionPreparser.nodeSrcStart(b, inner),
                LogicalExpressionPreparser.nodeSrcEnd(b, inner),
            )).toBe('adguard');
        });

        test('(adguard_ext_android_cb || adguard_ext_safari)', () => {
            const source = '(adguard_ext_android_cb || adguard_ext_safari)';
            const b = preparse(source);
            const root = LogicalExpressionPreparser.rootIndex(b);
            expect(LogicalExpressionPreparser.nodeKind(b, root)).toBe(LE_KIND_PAR);
            const inner = LogicalExpressionPreparser.nodeLeft(b, root);
            expect(LogicalExpressionPreparser.nodeKind(b, inner)).toBe(LE_KIND_OR);
        });
    });

    describe('operator precedence', () => {
        test('a || b && c — AND binds tighter than OR', () => {
            const source = 'a || b && c';
            const b = preparse(source);
            const root = LogicalExpressionPreparser.rootIndex(b);
            // Root should be OR: left=a, right=(AND: b, c)
            expect(LogicalExpressionPreparser.nodeKind(b, root)).toBe(LE_KIND_OR);

            const left = LogicalExpressionPreparser.nodeLeft(b, root);
            expect(LogicalExpressionPreparser.nodeKind(b, left)).toBe(LE_KIND_VAR);
            expect(source.slice(
                LogicalExpressionPreparser.nodeSrcStart(b, left),
                LogicalExpressionPreparser.nodeSrcEnd(b, left),
            )).toBe('a');

            const right = LogicalExpressionPreparser.nodeRight(b, root);
            expect(LogicalExpressionPreparser.nodeKind(b, right)).toBe(LE_KIND_AND);
        });

        test('a && b || c — left-to-right with correct precedence', () => {
            const source = 'a && b || c';
            const b = preparse(source);
            const root = LogicalExpressionPreparser.rootIndex(b);
            // Root should be OR: left=(AND: a, b), right=c
            expect(LogicalExpressionPreparser.nodeKind(b, root)).toBe(LE_KIND_OR);

            const left = LogicalExpressionPreparser.nodeLeft(b, root);
            expect(LogicalExpressionPreparser.nodeKind(b, left)).toBe(LE_KIND_AND);

            const right = LogicalExpressionPreparser.nodeRight(b, root);
            expect(LogicalExpressionPreparser.nodeKind(b, right)).toBe(LE_KIND_VAR);
            expect(source.slice(
                LogicalExpressionPreparser.nodeSrcStart(b, right),
                LogicalExpressionPreparser.nodeSrcEnd(b, right),
            )).toBe('c');
        });

        test('!a && b — NOT binds tighter than AND', () => {
            const source = '!a && b';
            const b = preparse(source);
            const root = LogicalExpressionPreparser.rootIndex(b);
            expect(LogicalExpressionPreparser.nodeKind(b, root)).toBe(LE_KIND_AND);

            const left = LogicalExpressionPreparser.nodeLeft(b, root);
            expect(LogicalExpressionPreparser.nodeKind(b, left)).toBe(LE_KIND_NOT);
        });
    });

    describe('complex expressions', () => {
        test('(adguard_ext_android_cb || adguard_ext_safari) && !adguard_ext_chromium', () => {
            const source = '(adguard_ext_android_cb || adguard_ext_safari) && !adguard_ext_chromium';
            const b = preparse(source);
            const root = LogicalExpressionPreparser.rootIndex(b);
            expect(LogicalExpressionPreparser.nodeKind(b, root)).toBe(LE_KIND_AND);
            const left = LogicalExpressionPreparser.nodeLeft(b, root);
            expect(LogicalExpressionPreparser.nodeKind(b, left)).toBe(LE_KIND_PAR);
            const right = LogicalExpressionPreparser.nodeRight(b, root);
            expect(LogicalExpressionPreparser.nodeKind(b, right)).toBe(LE_KIND_NOT);
        });
    });

    describe('empty expression', () => {
        test('empty string — root is -1', () => {
            const b = preparse('');
            expect(LogicalExpressionPreparser.rootIndex(b)).toBe(-1);
            expect(LogicalExpressionPreparser.nodeCount(b)).toBe(0);
        });
    });

    describe('error cases', () => {
        test('missing closing parenthesis throws', () => {
            expect(() => preparse('(adguard')).toThrow('closing parenthesis');
        });

        test('unexpected token throws', () => {
            expect(() => preparse('adguard : other')).toThrow('Unexpected token');
        });

        test('bare || throws', () => { expect(() => preparse('||')).toThrow(); });
        test('bare && throws', () => { expect(() => preparse('&&')).toThrow(); });
        test('||&& throws', () => { expect(() => preparse('||&&')).toThrow(); });
        test('|| && throws', () => { expect(() => preparse('|| &&')).toThrow(); });
        test('&&|| throws', () => { expect(() => preparse('&&||')).toThrow(); });
        test('&& || throws', () => { expect(() => preparse('&& ||')).toThrow(); });
        test('a|| throws (dangling operator)', () => { expect(() => preparse('a||')).toThrow(); });
        test('a&& throws (dangling operator)', () => { expect(() => preparse('a&&')).toThrow(); });
        test('a || throws (dangling operator)', () => { expect(() => preparse('a ||')).toThrow(); });
        test('a && throws (dangling operator)', () => { expect(() => preparse('a &&')).toThrow(); });
        test('a|||b throws (triple pipe)', () => { expect(() => preparse('a|||b')).toThrow(); });
        test('a&&&b throws (triple amp)', () => { expect(() => preparse('a&&&b')).toThrow(); });
        test('a||&&b throws (mixed operators)', () => { expect(() => preparse('a||&&b')).toThrow(); });
        test('a||b&& throws (dangling at end)', () => { expect(() => preparse('a||b&&')).toThrow(); });

        test('(a throws (unclosed paren)', () => { expect(() => preparse('(a')).toThrow(); });
        test('a) throws (unexpected close paren)', () => { expect(() => preparse('a)')).toThrow(); });
        test('((a) throws (one missing close paren)', () => { expect(() => preparse('((a)')).toThrow(); });
        test('(a)) throws (extra close paren)', () => { expect(() => preparse('(a))')).toThrow(); });
        test('(a||b&&c throws (unclosed paren)', () => { expect(() => preparse('(a||b&&c')).toThrow(); });

        // Behavioral difference from the old char-level parser: the new tokenizer
        // maps `_` and digits as valid Ident-continuation chars, so `_a` and `1a`
        // are tokenized as single Ident tokens and accepted as variable names.
        test('_a && b — accepted (underscore is a valid Ident char in the tokenizer)', () => {
            const b = preparse('_a && b');
            expect(LogicalExpressionPreparser.rootIndex(b)).not.toBe(-1);
        });

        test('1a && b — accepted (digit is a valid Ident char in the tokenizer)', () => {
            const b = preparse('1a && b');
            expect(LogicalExpressionPreparser.rootIndex(b)).not.toBe(-1);
        });

        test('á throws (non-ASCII character)', () => { expect(() => preparse('á')).toThrow(); });

        test('aaa || bb$b throws (dollar sign not valid)', () => {
            expect(() => preparse('aaa || bb$b')).toThrow();
        });
    });

    describe('parse — AST structure with location', () => {
        test('a', () => {
            expect(parseAst('a')).toMatchObject({
                type: 'Variable',
                start: 0,
                end: 1,
                name: 'a',
            });
        });

        test('!a', () => {
            expect(parseAst('!a')).toMatchObject({
                type: 'Operator',
                start: 0,
                end: 2,
                operator: '!',
                left: {
                    type: 'Variable',
                    start: 1,
                    end: 2,
                    name: 'a',
                },
            });
        });

        test('!!a', () => {
            expect(parseAst('!!a')).toMatchObject({
                type: 'Operator',
                start: 0,
                end: 3,
                operator: '!',
                left: {
                    type: 'Operator',
                    start: 1,
                    end: 3,
                    operator: '!',
                    left: {
                        type: 'Variable',
                        start: 2,
                        end: 3,
                        name: 'a',
                    },
                },
            });
        });

        test('!(!a)', () => {
            expect(parseAst('!(!a)')).toMatchObject({
                type: 'Operator',
                start: 0,
                end: 4,
                operator: '!',
                left: {
                    type: 'Parenthesis',
                    start: 2,
                    end: 4,
                    expression: {
                        type: 'Operator',
                        start: 2,
                        end: 4,
                        operator: '!',
                        left: {
                            type: 'Variable',
                            start: 3,
                            end: 4,
                            name: 'a',
                        },
                    },
                },
            });
        });

        test('a||b (no spaces)', () => {
            expect(parseAst('a||b')).toMatchObject({
                type: 'Operator',
                start: 0,
                end: 4,
                operator: '||',
                left: {
                    type: 'Variable', start: 0, end: 1, name: 'a',
                },
                right: {
                    type: 'Variable', start: 3, end: 4, name: 'b',
                },
            });
        });

        test('a || b (with spaces)', () => {
            expect(parseAst('a || b')).toMatchObject({
                type: 'Operator',
                start: 0,
                end: 6,
                operator: '||',
                left: {
                    type: 'Variable', start: 0, end: 1, name: 'a',
                },
                right: {
                    type: 'Variable', start: 5, end: 6, name: 'b',
                },
            });
        });

        test('(a)', () => {
            expect(parseAst('(a)')).toMatchObject({
                type: 'Parenthesis',
                start: 1,
                end: 2,
                expression: {
                    type: 'Variable',
                    start: 1,
                    end: 2,
                    name: 'a',
                },
            });
        });

        test('(a||b)', () => {
            expect(parseAst('(a||b)')).toMatchObject({
                type: 'Parenthesis',
                start: 1,
                end: 5,
                expression: {
                    type: 'Operator',
                    start: 1,
                    end: 5,
                    operator: '||',
                    left: {
                        type: 'Variable', start: 1, end: 2, name: 'a',
                    },
                    right: {
                        type: 'Variable', start: 4, end: 5, name: 'b',
                    },
                },
            });
        });

        test('((a) && (!(b)))', () => {
            expect(parseAst('((a) && (!(b)))')).toMatchObject({
                type: 'Parenthesis',
                start: 2,
                end: 12,
                expression: {
                    type: 'Operator',
                    start: 2,
                    end: 12,
                    operator: '&&',
                    left: {
                        type: 'Parenthesis',
                        start: 2,
                        end: 3,
                        expression: {
                            type: 'Variable', start: 2, end: 3, name: 'a',
                        },
                    },
                    right: {
                        type: 'Parenthesis',
                        start: 9,
                        end: 12,
                        expression: {
                            type: 'Operator',
                            start: 9,
                            end: 12,
                            operator: '!',
                            left: {
                                type: 'Parenthesis',
                                start: 11,
                                end: 12,
                                expression: {
                                    type: 'Variable', start: 11, end: 12, name: 'b',
                                },
                            },
                        },
                    },
                },
            });
        });

        // eslint-disable-next-line max-len
        test('(adguard && !adguard_ext_safari) && (adguard_ext_android || (adguard_ext_chromium && (!adguard_ext_firefox)))', () => {
            expect(
                // eslint-disable-next-line max-len
                parseAst('(adguard && !adguard_ext_safari) && (adguard_ext_android || (adguard_ext_chromium && (!adguard_ext_firefox)))'),
            ).toMatchObject({
                type: 'Operator',
                start: 1,
                end: 106,
                operator: '&&',
                left: {
                    type: 'Parenthesis',
                    start: 1,
                    end: 31,
                    expression: {
                        type: 'Operator',
                        start: 1,
                        end: 31,
                        operator: '&&',
                        left: {
                            type: 'Variable', start: 1, end: 8, name: 'adguard',
                        },
                        right: {
                            type: 'Operator',
                            start: 12,
                            end: 31,
                            operator: '!',
                            left: {
                                type: 'Variable', start: 13, end: 31, name: 'adguard_ext_safari',
                            },
                        },
                    },
                },
                right: {
                    type: 'Parenthesis',
                    start: 37,
                    end: 106,
                    expression: {
                        type: 'Operator',
                        start: 37,
                        end: 106,
                        operator: '||',
                        left: {
                            type: 'Variable', start: 37, end: 56, name: 'adguard_ext_android',
                        },
                        right: {
                            type: 'Parenthesis',
                            start: 61,
                            end: 106,
                            expression: {
                                type: 'Operator',
                                start: 61,
                                end: 106,
                                operator: '&&',
                                left: {
                                    type: 'Variable', start: 61, end: 81, name: 'adguard_ext_chromium',
                                },
                                right: {
                                    type: 'Parenthesis',
                                    start: 86,
                                    end: 106,
                                    expression: {
                                        type: 'Operator',
                                        start: 86,
                                        end: 106,
                                        operator: '!',
                                        left: {
                                            type: 'Variable', start: 87, end: 106, name: 'adguard_ext_firefox',
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            });
        });
    });

    describe('parse — isLocIncluded: false', () => {
        test('!a without location', () => {
            expect(parseAst('!a', false)).toEqual({
                type: 'Operator',
                operator: '!',
                left: {
                    type: 'Variable',
                    name: 'a',
                },
            });
        });
    });

    describe('generate', () => {
        test('a', () => { expect(parseAndGenerate('a')).toEqual('a'); });
        test('!a', () => { expect(parseAndGenerate('!a')).toEqual('!a'); });
        test('!!a', () => { expect(parseAndGenerate('!!a')).toEqual('!!a'); });
        test('!(!a)', () => { expect(parseAndGenerate('!(!a)')).toEqual('!(!a)'); });

        test('a||b normalises spacing', () => { expect(parseAndGenerate('a||b')).toEqual('a || b'); });
        test('a || b', () => { expect(parseAndGenerate('a || b')).toEqual('a || b'); });

        test('!a||b', () => { expect(parseAndGenerate('!a||b')).toEqual('!a || b'); });
        test('a || !b', () => { expect(parseAndGenerate('a || !b')).toEqual('a || !b'); });

        test('!(a)||b', () => { expect(parseAndGenerate('!(a)||b')).toEqual('!(a) || b'); });
        test('a || !(b)', () => { expect(parseAndGenerate('a || !(b)')).toEqual('a || !(b)'); });

        test('(!a)||b', () => { expect(parseAndGenerate('(!a)||b')).toEqual('(!a) || b'); });
        test('a || (!b)', () => { expect(parseAndGenerate('a || (!b)')).toEqual('a || (!b)'); });

        test('a&&b normalises spacing', () => { expect(parseAndGenerate('a&&b')).toEqual('a && b'); });
        test('a && b', () => { expect(parseAndGenerate('a && b')).toEqual('a && b'); });

        test('(a)', () => { expect(parseAndGenerate('(a)')).toEqual('(a)'); });
        test('(a||b)', () => { expect(parseAndGenerate('(a||b)')).toEqual('(a || b)'); });
        test('(a || b)', () => { expect(parseAndGenerate('(a || b)')).toEqual('(a || b)'); });
        test('((a) || b)', () => { expect(parseAndGenerate('((a) || b)')).toEqual('((a) || b)'); });
        test('((((a))) || b)', () => { expect(parseAndGenerate('((((a))) || b)')).toEqual('((((a))) || b)'); });
        test('((a) || ((b)))', () => { expect(parseAndGenerate('((a) || ((b)))')).toEqual('((a) || ((b)))'); });
        test('((a) || (!(b)))', () => { expect(parseAndGenerate('((a) || (!(b)))')).toEqual('((a) || (!(b)))'); });

        test('(a&&b)', () => { expect(parseAndGenerate('(a&&b)')).toEqual('(a && b)'); });
        test('(a && b)', () => { expect(parseAndGenerate('(a && b)')).toEqual('(a && b)'); });
        test('((a) && b)', () => { expect(parseAndGenerate('((a) && b)')).toEqual('((a) && b)'); });
        test('((((a))) && b)', () => { expect(parseAndGenerate('((((a))) && b)')).toEqual('((((a))) && b)'); });
        test('((a) && ((b)))', () => { expect(parseAndGenerate('((a) && ((b)))')).toEqual('((a) && ((b)))'); });
        test('((a) && (!(b)))', () => { expect(parseAndGenerate('((a) && (!(b)))')).toEqual('((a) && (!(b)))'); });

        test('((a) || (!(b))) && c', () => {
            expect(parseAndGenerate('((a) || (!(b))) && c')).toEqual('((a) || (!(b))) && c');
        });

        test('((!!a) || (!(b))) && ((!!(!!c)))', () => {
            expect(parseAndGenerate('((!!a) || (!(b))) && ((!!(!!c)))')).toEqual('((!!a) || (!(b))) && ((!!(!!c)))');
        });

        test('complex adguard expression', () => {
            // eslint-disable-next-line max-len
            expect(parseAndGenerate('(adguard && !adguard_ext_safari) && (adguard_ext_android || (adguard_ext_chromium && (!adguard_ext_firefox)))'))
                // eslint-disable-next-line max-len
                .toEqual('(adguard && !adguard_ext_safari) && (adguard_ext_android || (adguard_ext_chromium && (!adguard_ext_firefox)))');
        });

        test('complex adguard expression with triple parens', () => {
            // eslint-disable-next-line max-len
            expect(parseAndGenerate('(((adguard)) && !adguard_ext_safari) && ((adguard_ext_android) || (adguard_ext_chromium && (!adguard_ext_firefox)))'))
                // eslint-disable-next-line max-len
                .toEqual('(((adguard)) && !adguard_ext_safari) && ((adguard_ext_android) || (adguard_ext_chromium && (!adguard_ext_firefox)))');
        });
    });
});
