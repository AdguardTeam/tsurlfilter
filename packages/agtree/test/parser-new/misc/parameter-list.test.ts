import { describe, expect, test } from 'vitest';

import { ParameterListAstParser } from '../../../src/parser-new/misc/parameter-list';
import { createPreparserContext, initPreparserContext } from '../../../src/preparser/context';
import { ParameterListPreparser, PL_BUFFER_SIZE } from '../../../src/preparser/misc/parameter-list';
import { tokenizeLine } from '../../../src/tokenizer/tokenizer';
import type { TokenizeResult } from '../../../src/tokenizer/tokenizer';
import { QuoteType } from '../../../src/utils/quotes';

const tokenResult: TokenizeResult = {
    tokenCount: 0,
    types: new Uint8Array(1024),
    ends: new Uint32Array(1024),
    actualEnd: 0,
    overflowed: 0,
};

const ctx = createPreparserContext();
const plBuf = new Int32Array(PL_BUFFER_SIZE);

/**
 * Tokenize, preparse, and build a ParameterList AST from an inner source string
 * (no surrounding parentheses — the caller is responsible for stripping them).
 *
 * @param source Inner source string (no surrounding parentheses).
 * @param isLocIncluded Whether to include source locations.
 *
 * @returns ParameterList AST node.
 */
function parse(source: string, isLocIncluded = false) {
    tokenizeLine(source, 0, tokenResult);
    initPreparserContext(ctx, source, tokenResult);
    ParameterListPreparser.preparse(ctx, 0, tokenResult.tokenCount, 0, source.length, plBuf);
    return ParameterListAstParser.parse(source, plBuf, isLocIncluded);
}

describe('ParameterListAstParser', () => {
    describe('single parameter (without location)', () => {
        test('a', () => {
            expect(parse('a')).toEqual({
                type: 'ParameterList',
                children: [{ type: 'Parameter', quoteType: QuoteType.None, value: 'a' }],
            });
        });

        test('content_blockers', () => {
            expect(parse('content_blockers')).toEqual({
                type: 'ParameterList',
                children: [{ type: 'Parameter', quoteType: QuoteType.None, value: 'content_blockers' }],
            });
        });

        test(' a  — leading/trailing whitespace trimmed', () => {
            expect(parse(' a ')).toEqual({
                type: 'ParameterList',
                children: [{ type: 'Parameter', quoteType: QuoteType.None, value: 'a' }],
            });
        });
    });

    describe('multiple parameters (without location)', () => {
        test('a,b', () => {
            expect(parse('a,b')).toEqual({
                type: 'ParameterList',
                children: [
                    { type: 'Parameter', quoteType: QuoteType.None, value: 'a' },
                    { type: 'Parameter', quoteType: QuoteType.None, value: 'b' },
                ],
            });
        });

        test('a, b', () => {
            expect(parse('a, b')).toEqual({
                type: 'ParameterList',
                children: [
                    { type: 'Parameter', quoteType: QuoteType.None, value: 'a' },
                    { type: 'Parameter', quoteType: QuoteType.None, value: 'b' },
                ],
            });
        });

        test('a,b,c', () => {
            expect(parse('a,b,c')).toEqual({
                type: 'ParameterList',
                children: [
                    { type: 'Parameter', quoteType: QuoteType.None, value: 'a' },
                    { type: 'Parameter', quoteType: QuoteType.None, value: 'b' },
                    { type: 'Parameter', quoteType: QuoteType.None, value: 'c' },
                ],
            });
        });
    });

    describe('null parameters (without location)', () => {
        test(',b — leading null', () => {
            expect(parse(',b')).toEqual({
                type: 'ParameterList',
                children: [
                    null,
                    { type: 'Parameter', quoteType: QuoteType.None, value: 'b' },
                ],
            });
        });

        test('a, — trailing null', () => {
            expect(parse('a,')).toEqual({
                type: 'ParameterList',
                children: [
                    { type: 'Parameter', quoteType: QuoteType.None, value: 'a' },
                    null,
                ],
            });
        });
    });

    describe('empty list (without location)', () => {
        test('empty string — empty children', () => {
            expect(parse('')).toEqual({
                type: 'ParameterList',
                children: [],
            });
        });
    });

    describe('with location', () => {
        test('a — list and child locations', () => {
            expect(parse('a', true)).toEqual({
                type: 'ParameterList',
                start: 0,
                end: 1,
                children: [
                    {
                        type: 'Parameter',
                        quoteType: QuoteType.None,
                        value: 'a',
                        start: 0,
                        end: 1,
                    },
                ],
            });
        });

        test('content_blockers — correct offsets', () => {
            expect(parse('content_blockers', true)).toEqual({
                type: 'ParameterList',
                start: 0,
                end: 16,
                children: [
                    {
                        type: 'Parameter',
                        quoteType: QuoteType.None,
                        value: 'content_blockers',
                        start: 0,
                        end: 16,
                    },
                ],
            });
        });

        test('a, b — two params with locations', () => {
            expect(parse('a, b', true)).toEqual({
                type: 'ParameterList',
                start: 0,
                end: 4,
                children: [
                    {
                        type: 'Parameter',
                        quoteType: QuoteType.None,
                        value: 'a',
                        start: 0,
                        end: 1,
                    },
                    {
                        type: 'Parameter',
                        quoteType: QuoteType.None,
                        value: 'b',
                        start: 3,
                        end: 4,
                    },
                ],
            });
        });

        test('empty string — empty list locations', () => {
            expect(parse('', true)).toEqual({
                type: 'ParameterList',
                start: 0,
                end: 0,
                children: [],
            });
        });
    });

    // -------------------------------------------------------------------
    // Escape handling — parity with ArglistParser (uBlock Origin behaviour)
    // -------------------------------------------------------------------
    // Convention used in comments below:
    //   \,   = backslash + comma  (2 raw chars) — escaped comma
    //   \\   = two backslashes   (2 raw chars) — will NOT escape the comma that follows
    //   \\\, = \\ + \,           (4 raw chars) — one escaped \\ pair + one escaped comma
    //
    // Rule: N consecutive backslashes before a comma
    //   • N is odd  → last backslash is the escape; strip it; comma becomes literal
    //   • N is even → all backslashes form pairs (literal); comma is a real separator
    // -------------------------------------------------------------------
    describe('escape handling — backslash-comma sequences', () => {
        test('\\, — single escape → one param with literal comma', () => {
            // raw: \,   →  escaped comma  →  value ","
            expect(parse('\\,')).toEqual({
                type: 'ParameterList',
                children: [{ type: 'Parameter', quoteType: QuoteType.None, value: ',' }],
            });
        });

        test('a\\,b — escape in middle → one param', () => {
            // raw: a\,b  →  one param, value "a,b"
            expect(parse('a\\,b')).toEqual({
                type: 'ParameterList',
                children: [{ type: 'Parameter', quoteType: QuoteType.None, value: 'a,b' }],
            });
        });

        test('a\\\\,b — double backslash then real separator → two params', () => {
            // raw: a\\,b  →  Escaped(\\) + Comma  →  params "a\\" and "b"
            expect(parse('a\\\\,b')).toEqual({
                type: 'ParameterList',
                children: [
                    { type: 'Parameter', quoteType: QuoteType.None, value: 'a\\\\' },
                    { type: 'Parameter', quoteType: QuoteType.None, value: 'b' },
                ],
            });
        });

        test('a\\\\\\\\\\\\,b — three backslashes (pair + escape) → one param', () => {
            // raw: a\\\,b  →  Escaped(\\) + Escaped(\,) → one param, value "a\\,b"
            // (String.raw used: 'a\\\\\\,b' in JS would be a\\,b due to \, escape eating)
            // ArglistParser.normalizeArg for a\\\,b → a\\,b
            expect(parse(String.raw`a\\\,b`)).toEqual({
                type: 'ParameterList',
                children: [{ type: 'Parameter', quoteType: QuoteType.None, value: 'a\\\\,b' }],
            });
        });

        test('a\\\\\\\\,b — four backslashes then real separator → two params', () => {
            // raw: a\\\\,b  →  Escaped(\\) + Escaped(\\) + Comma → params "a\\\\" and "b"
            expect(parse('a\\\\\\\\,b')).toEqual({
                type: 'ParameterList',
                children: [
                    { type: 'Parameter', quoteType: QuoteType.None, value: 'a\\\\\\\\' },
                    { type: 'Parameter', quoteType: QuoteType.None, value: 'b' },
                ],
            });
        });

        test('a\\\\\\\\\\\\\\\\\\\\,b — five backslashes (two pairs + escape) → one param', () => {
            // raw: a\\\\\,b  →  Escaped(\\) + Escaped(\\) + Escaped(\,) → value "a\\\\,b"
            // (String.raw used: plain JS literal would consume the last \ in \,)
            expect(parse(String.raw`a\\\\\,b`)).toEqual({
                type: 'ParameterList',
                children: [{ type: 'Parameter', quoteType: QuoteType.None, value: 'a\\\\\\\\,b' }],
            });
        });

        test('\\\\, — trailing separator after double backslash → two params', () => {
            // raw: \\,   →  Escaped(\\) + Comma  →  param "\\\\" and null
            expect(parse('\\\\,')).toEqual({
                type: 'ParameterList',
                children: [
                    { type: 'Parameter', quoteType: QuoteType.None, value: '\\\\' },
                    null,
                ],
            });
        });

        test('multiple escaped commas in one param', () => {
            // raw: a\,b\,c  →  no Comma token  →  one param, value "a,b,c"
            expect(parse('a\\,b\\,c')).toEqual({
                type: 'ParameterList',
                children: [{ type: 'Parameter', quoteType: QuoteType.None, value: 'a,b,c' }],
            });
        });

        test('escaped comma and real separator mixed', () => {
            // raw: a\,b,c  →  Escaped(\,) within first segment, real Comma after "b"
            // → params "a,b" (unescaped) and "c"
            expect(parse('a\\,b,c')).toEqual({
                type: 'ParameterList',
                children: [
                    { type: 'Parameter', quoteType: QuoteType.None, value: 'a,b' },
                    { type: 'Parameter', quoteType: QuoteType.None, value: 'c' },
                ],
            });
        });
    });
});
