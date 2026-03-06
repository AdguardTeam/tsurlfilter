import { describe, test, expect } from 'vitest';

import { tokenizeLine } from '../../../src/tokenizer/tokenizer';
import type { TokenizeResult } from '../../../src/tokenizer/tokenizer';
import { createPreparserContext, initPreparserContext } from '../../../src/preparser/context';
import { ParameterListPreparser, PL_BUFFER_SIZE } from '../../../src/preparser/misc/parameter-list';
import { ParameterListAstParser } from '../../../src/parser-new/misc/parameter-list';

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
 * @param source        Inner source string (no surrounding parentheses).
 * @param isLocIncluded Whether to include source locations.
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
                children: [{ type: 'Value', value: 'a' }],
            });
        });

        test('content_blockers', () => {
            expect(parse('content_blockers')).toEqual({
                type: 'ParameterList',
                children: [{ type: 'Value', value: 'content_blockers' }],
            });
        });

        test(' a  — leading/trailing whitespace trimmed', () => {
            expect(parse(' a ')).toEqual({
                type: 'ParameterList',
                children: [{ type: 'Value', value: 'a' }],
            });
        });
    });

    describe('multiple parameters (without location)', () => {
        test('a,b', () => {
            expect(parse('a,b')).toEqual({
                type: 'ParameterList',
                children: [
                    { type: 'Value', value: 'a' },
                    { type: 'Value', value: 'b' },
                ],
            });
        });

        test('a, b', () => {
            expect(parse('a, b')).toEqual({
                type: 'ParameterList',
                children: [
                    { type: 'Value', value: 'a' },
                    { type: 'Value', value: 'b' },
                ],
            });
        });

        test('a,b,c', () => {
            expect(parse('a,b,c')).toEqual({
                type: 'ParameterList',
                children: [
                    { type: 'Value', value: 'a' },
                    { type: 'Value', value: 'b' },
                    { type: 'Value', value: 'c' },
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
                    { type: 'Value', value: 'b' },
                ],
            });
        });

        test('a, — trailing null', () => {
            expect(parse('a,')).toEqual({
                type: 'ParameterList',
                children: [
                    { type: 'Value', value: 'a' },
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
                        type: 'Value',
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
                        type: 'Value',
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
                        type: 'Value',
                        value: 'a',
                        start: 0,
                        end: 1,
                    },
                    {
                        type: 'Value',
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
});
