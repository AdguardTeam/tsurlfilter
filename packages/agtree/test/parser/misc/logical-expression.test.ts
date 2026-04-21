import { describe, expect, test } from 'vitest';

import { LogicalExpressionAstBuilder } from '../../../src/ast-builder/misc/logical-expression';
import { LogicalExpressionGenerator } from '../../../src/generator/misc/logical-expression-generator';
import type { AnyExpressionNode } from '../../../src/nodes';
import {
    createParserContext,
    initParserContext,
    LE_BUFFER_SIZE,
    LE_KIND_AND,
    LE_KIND_NOT,
    LE_KIND_OR,
    LE_KIND_PAR,
    LE_KIND_VAR,
    LogicalExpressionParser,
} from '../../../src/parser';
import { Tokenizer } from '../../../src/tokenizer/tokenizer';

const tokenizer = new Tokenizer(1024);

const ctx = createParserContext();
const buf = new Int32Array(LE_BUFFER_SIZE);

/**
 * Tokenize + parse a logical expression in one step for convenience.
 *
 * @param source Source string containing the expression.
 * @param startOffset Source start offset (default 0).
 *
 * @returns Output buffer with the flat node-tree.
 */
function parse(source: string, startOffset = 0): Int32Array {
    tokenizer.source = source;
    tokenizer.offset = startOffset;
    tokenizer.tokenize();
    initParserContext(ctx, source, tokenizer, startOffset);
    LogicalExpressionParser.parse(ctx, 0, tokenizer.tokenCount, buf);
    return buf;
}

/**
 * Full pipeline: tokenize → parse → build AST.
 *
 * @param source Logical expression source string.
 * @param isLocIncluded Whether to include source offsets in AST nodes.
 *
 * @returns Root `AnyExpressionNode`.
 */
function parseAst(source: string, isLocIncluded = true): AnyExpressionNode {
    parse(source);
    return LogicalExpressionAstBuilder.parse(source, buf, isLocIncluded);
}

/**
 * Full pipeline: tokenize → parse → build AST → generate.
 *
 * @param source Logical expression source string.
 *
 * @returns Generated string representation.
 */
function parseAndGenerate(source: string): string {
    return LogicalExpressionGenerator.generate(parseAst(source));
}

describe('LogicalExpressionParser', () => {
    describe('single variable', () => {
        test('adguard', () => {
            const b = parse('adguard');
            expect(LogicalExpressionParser.rootIndex(b)).toBe(0);
            expect(LogicalExpressionParser.nodeCount(b)).toBe(1);
            expect(LogicalExpressionParser.nodeKind(b, 0)).toBe(LE_KIND_VAR);
            expect(LogicalExpressionParser.nodeSrcStart(b, 0)).toBe(0);
            expect(LogicalExpressionParser.nodeSrcEnd(b, 0)).toBe(7);
        });

        test('adguard_ext_safari', () => {
            const source = 'adguard_ext_safari';
            const b = parse(source);
            expect(LogicalExpressionParser.nodeKind(b, 0)).toBe(LE_KIND_VAR);
            expect(LogicalExpressionParser.nodeSrcStart(b, 0)).toBe(0);
            expect(LogicalExpressionParser.nodeSrcEnd(b, 0)).toBe(source.length);
        });

        test('adguard-ext-safari — hyphens part of ident token', () => {
            const source = 'adguard-ext-safari';
            const b = parse(source);
            expect(LogicalExpressionParser.nodeKind(b, 0)).toBe(LE_KIND_VAR);
            expect(source.slice(
                LogicalExpressionParser.nodeSrcStart(b, 0),
                LogicalExpressionParser.nodeSrcEnd(b, 0),
            )).toBe('adguard-ext-safari');
        });
    });

    describe('NOT operator', () => {
        test('!adguard', () => {
            const source = '!adguard';
            const b = parse(source);
            expect(LogicalExpressionParser.nodeCount(b)).toBe(2);
            const root = LogicalExpressionParser.rootIndex(b);
            expect(LogicalExpressionParser.nodeKind(b, root)).toBe(LE_KIND_NOT);
            expect(LogicalExpressionParser.nodeSrcStart(b, root)).toBe(0);
            expect(LogicalExpressionParser.nodeSrcEnd(b, root)).toBe(source.length);
            const child = LogicalExpressionParser.nodeLeft(b, root);
            expect(LogicalExpressionParser.nodeKind(b, child)).toBe(LE_KIND_VAR);
            expect(LogicalExpressionParser.nodeSrcStart(b, child)).toBe(1);
        });

        test('! adguard — space between ! and variable', () => {
            const source = '! adguard';
            const b = parse(source);
            const root = LogicalExpressionParser.rootIndex(b);
            expect(LogicalExpressionParser.nodeKind(b, root)).toBe(LE_KIND_NOT);
            expect(LogicalExpressionParser.nodeSrcStart(b, root)).toBe(0);
        });
    });

    describe('AND operator', () => {
        test('adguard && adguard_ext_safari', () => {
            const source = 'adguard && adguard_ext_safari';
            const b = parse(source);
            const root = LogicalExpressionParser.rootIndex(b);
            expect(LogicalExpressionParser.nodeKind(b, root)).toBe(LE_KIND_AND);
            expect(LogicalExpressionParser.nodeSrcStart(b, root)).toBe(0);
            expect(LogicalExpressionParser.nodeSrcEnd(b, root)).toBe(source.length);

            const left = LogicalExpressionParser.nodeLeft(b, root);
            expect(LogicalExpressionParser.nodeKind(b, left)).toBe(LE_KIND_VAR);
            expect(source.slice(
                LogicalExpressionParser.nodeSrcStart(b, left),
                LogicalExpressionParser.nodeSrcEnd(b, left),
            )).toBe('adguard');

            const right = LogicalExpressionParser.nodeRight(b, root);
            expect(LogicalExpressionParser.nodeKind(b, right)).toBe(LE_KIND_VAR);
            expect(source.slice(
                LogicalExpressionParser.nodeSrcStart(b, right),
                LogicalExpressionParser.nodeSrcEnd(b, right),
            )).toBe('adguard_ext_safari');
        });
    });

    describe('OR operator', () => {
        test('adguard || adguard_ext_safari', () => {
            const source = 'adguard || adguard_ext_safari';
            const b = parse(source);
            const root = LogicalExpressionParser.rootIndex(b);
            expect(LogicalExpressionParser.nodeKind(b, root)).toBe(LE_KIND_OR);

            const left = LogicalExpressionParser.nodeLeft(b, root);
            expect(source.slice(
                LogicalExpressionParser.nodeSrcStart(b, left),
                LogicalExpressionParser.nodeSrcEnd(b, left),
            )).toBe('adguard');

            const right = LogicalExpressionParser.nodeRight(b, root);
            expect(source.slice(
                LogicalExpressionParser.nodeSrcStart(b, right),
                LogicalExpressionParser.nodeSrcEnd(b, right),
            )).toBe('adguard_ext_safari');
        });
    });

    describe('parentheses', () => {
        test('(adguard)', () => {
            const source = '(adguard)';
            const b = parse(source);
            const root = LogicalExpressionParser.rootIndex(b);
            expect(LogicalExpressionParser.nodeKind(b, root)).toBe(LE_KIND_PAR);
            const inner = LogicalExpressionParser.nodeLeft(b, root);
            expect(LogicalExpressionParser.nodeKind(b, inner)).toBe(LE_KIND_VAR);
            expect(source.slice(
                LogicalExpressionParser.nodeSrcStart(b, inner),
                LogicalExpressionParser.nodeSrcEnd(b, inner),
            )).toBe('adguard');
        });

        test('(adguard_ext_android_cb || adguard_ext_safari)', () => {
            const source = '(adguard_ext_android_cb || adguard_ext_safari)';
            const b = parse(source);
            const root = LogicalExpressionParser.rootIndex(b);
            expect(LogicalExpressionParser.nodeKind(b, root)).toBe(LE_KIND_PAR);
            const inner = LogicalExpressionParser.nodeLeft(b, root);
            expect(LogicalExpressionParser.nodeKind(b, inner)).toBe(LE_KIND_OR);
        });
    });

    describe('operator precedence', () => {
        test('a || b && c — AND binds tighter than OR', () => {
            const source = 'a || b && c';
            const b = parse(source);
            const root = LogicalExpressionParser.rootIndex(b);
            // Root should be OR: left=a, right=(AND: b, c)
            expect(LogicalExpressionParser.nodeKind(b, root)).toBe(LE_KIND_OR);

            const left = LogicalExpressionParser.nodeLeft(b, root);
            expect(LogicalExpressionParser.nodeKind(b, left)).toBe(LE_KIND_VAR);
            expect(source.slice(
                LogicalExpressionParser.nodeSrcStart(b, left),
                LogicalExpressionParser.nodeSrcEnd(b, left),
            )).toBe('a');

            const right = LogicalExpressionParser.nodeRight(b, root);
            expect(LogicalExpressionParser.nodeKind(b, right)).toBe(LE_KIND_AND);
        });

        test('a && b || c — left-to-right with correct precedence', () => {
            const source = 'a && b || c';
            const b = parse(source);
            const root = LogicalExpressionParser.rootIndex(b);
            // Root should be OR: left=(AND: a, b), right=c
            expect(LogicalExpressionParser.nodeKind(b, root)).toBe(LE_KIND_OR);

            const left = LogicalExpressionParser.nodeLeft(b, root);
            expect(LogicalExpressionParser.nodeKind(b, left)).toBe(LE_KIND_AND);

            const right = LogicalExpressionParser.nodeRight(b, root);
            expect(LogicalExpressionParser.nodeKind(b, right)).toBe(LE_KIND_VAR);
            expect(source.slice(
                LogicalExpressionParser.nodeSrcStart(b, right),
                LogicalExpressionParser.nodeSrcEnd(b, right),
            )).toBe('c');
        });

        test('!a && b — NOT binds tighter than AND', () => {
            const source = '!a && b';
            const b = parse(source);
            const root = LogicalExpressionParser.rootIndex(b);
            expect(LogicalExpressionParser.nodeKind(b, root)).toBe(LE_KIND_AND);

            const left = LogicalExpressionParser.nodeLeft(b, root);
            expect(LogicalExpressionParser.nodeKind(b, left)).toBe(LE_KIND_NOT);
        });
    });

    describe('complex expressions', () => {
        test('(adguard_ext_android_cb || adguard_ext_safari) && !adguard_ext_chromium', () => {
            const source = '(adguard_ext_android_cb || adguard_ext_safari) && !adguard_ext_chromium';
            const b = parse(source);
            const root = LogicalExpressionParser.rootIndex(b);
            expect(LogicalExpressionParser.nodeKind(b, root)).toBe(LE_KIND_AND);
            const left = LogicalExpressionParser.nodeLeft(b, root);
            expect(LogicalExpressionParser.nodeKind(b, left)).toBe(LE_KIND_PAR);
            const right = LogicalExpressionParser.nodeRight(b, root);
            expect(LogicalExpressionParser.nodeKind(b, right)).toBe(LE_KIND_NOT);
        });
    });

    describe('empty expression', () => {
        test('empty string — root is -1', () => {
            const b = parse('');
            expect(LogicalExpressionParser.rootIndex(b)).toBe(-1);
            expect(LogicalExpressionParser.nodeCount(b)).toBe(0);
        });
    });

    describe('error cases', () => {
        test('missing closing parenthesis throws', () => {
            expect(() => parse('(adguard')).toThrow('closing parenthesis');
        });

        test('unexpected token throws', () => {
            expect(() => parse('adguard : other')).toThrow('Unexpected token');
        });

        test('bare || throws', () => { expect(() => parse('||')).toThrow(); });
        test('bare && throws', () => { expect(() => parse('&&')).toThrow(); });
        test('||&& throws', () => { expect(() => parse('||&&')).toThrow(); });
        test('|| && throws', () => { expect(() => parse('|| &&')).toThrow(); });
        test('&&|| throws', () => { expect(() => parse('&&||')).toThrow(); });
        test('&& || throws', () => { expect(() => parse('&& ||')).toThrow(); });
        test('a|| throws (dangling operator)', () => { expect(() => parse('a||')).toThrow(); });
        test('a&& throws (dangling operator)', () => { expect(() => parse('a&&')).toThrow(); });
        test('a || throws (dangling operator)', () => { expect(() => parse('a ||')).toThrow(); });
        test('a && throws (dangling operator)', () => { expect(() => parse('a &&')).toThrow(); });
        test('a|||b throws (triple pipe)', () => { expect(() => parse('a|||b')).toThrow(); });
        test('a&&&b throws (triple amp)', () => { expect(() => parse('a&&&b')).toThrow(); });
        test('a||&&b throws (mixed operators)', () => { expect(() => parse('a||&&b')).toThrow(); });
        test('a||b&& throws (dangling at end)', () => { expect(() => parse('a||b&&')).toThrow(); });

        test('(a throws (unclosed paren)', () => { expect(() => parse('(a')).toThrow(); });
        test('a) throws (unexpected close paren)', () => { expect(() => parse('a)')).toThrow(); });
        test('((a) throws (one missing close paren)', () => { expect(() => parse('((a)')).toThrow(); });
        test('(a)) throws (extra close paren)', () => { expect(() => parse('(a))')).toThrow(); });
        test('(a||b&&c throws (unclosed paren)', () => { expect(() => parse('(a||b&&c')).toThrow(); });

        // With the split tokenizer `_a` starts with an Underscore token, which
        // isIdentStart accepts, so the expression is valid.
        test('_a && b — accepted (underscore is a valid ident-start)', () => {
            const b = parse('_a && b');
            expect(LogicalExpressionParser.rootIndex(b)).not.toBe(-1);
        });

        // `1a` now tokenizes as Digit + Letter; Digit is not an ident-start, so it throws.
        test('1a && b — throws (digit cannot start a variable name)', () => {
            expect(() => parse('1a && b')).toThrow();
        });

        test('á throws (non-ASCII character)', () => { expect(() => parse('á')).toThrow(); });

        test('aaa || bb$b throws (dollar sign not valid)', () => {
            expect(() => parse('aaa || bb$b')).toThrow();
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
