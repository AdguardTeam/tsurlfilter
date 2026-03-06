import { describe, test, expect } from 'vitest';

import { tokenizeLine } from '../../../src/tokenizer/tokenizer';
import type { TokenizeResult } from '../../../src/tokenizer/tokenizer';
import { createPreparserContext, initPreparserContext } from '../../../src/preparser/context';
import {
    ParameterListPreparser,
    PL_BUFFER_SIZE,
    PL_COUNT,
    PL_HEADER,
    PL_LIST_END,
    PL_LIST_START,
    PL_PARAM_END,
    PL_PARAM_START,
    PL_STRIDE,
} from '../../../src/preparser/misc/parameter-list';

const tokenResult: TokenizeResult = {
    tokenCount: 0,
    types: new Uint8Array(1024),
    ends: new Uint32Array(1024),
    actualEnd: 0,
    overflowed: 0,
};

const ctx = createPreparserContext();
const buf = new Int32Array(PL_BUFFER_SIZE);

/**
 * Tokenize and preparse a comma-separated parameter list (no surrounding parens).
 *
 * `listStart` and `listEnd` default to `0` / `input.length` so callers that
 * only care about param positions can omit them.
 *
 * @param input     Inner source string (no surrounding parentheses).
 * @param listStart Source position to store as the list start (default 0).
 * @param listEnd   Source position to store as the list end (default input.length).
 * @returns The filled buffer.
 */
function preparse(input: string, listStart = 0, listEnd = input.length): Int32Array {
    tokenizeLine(input, 0, tokenResult);
    initPreparserContext(ctx, input, tokenResult);
    ParameterListPreparser.preparse(ctx, 0, tokenResult.tokenCount, listStart, listEnd, buf);
    return buf;
}

/**
 * Reads a single param's source range from the buffer.
 *
 * @param data   Buffer filled by ParameterListPreparser.preparse.
 * @param source Original source string.
 * @param i      Param index (0-based).
 * @returns `{ start, end, value }` or `null` for a null param.
 */
function getParam(data: Int32Array, source: string, i: number): { start: number; end: number; value: string } | null {
    const start = data[PL_HEADER + i * PL_STRIDE + PL_PARAM_START];
    const end = data[PL_HEADER + i * PL_STRIDE + PL_PARAM_END];

    if (start === -1) {
        return null;
    }

    return {
        start,
        end,
        value: source.slice(start, end),
    };
}

describe('ParameterListPreparser', () => {
    describe('single parameter', () => {
        test('a', () => {
            const src = 'a';
            preparse(src);

            expect(buf[PL_COUNT]).toBe(1);
            expect(buf[PL_LIST_START]).toBe(0);
            expect(buf[PL_LIST_END]).toBe(1);
            expect(getParam(buf, src, 0)).toEqual({ start: 0, end: 1, value: 'a' });
        });

        test('content_blockers', () => {
            const src = 'content_blockers';
            preparse(src);

            expect(buf[PL_COUNT]).toBe(1);
            expect(buf[PL_LIST_START]).toBe(0);
            expect(buf[PL_LIST_END]).toBe(16);
            expect(getParam(buf, src, 0)).toEqual({ start: 0, end: 16, value: 'content_blockers' });
        });

        test(' a  — leading/trailing whitespace trimmed', () => {
            const src = ' a ';
            preparse(src);

            expect(buf[PL_COUNT]).toBe(1);
            expect(getParam(buf, src, 0)).toEqual({ start: 1, end: 2, value: 'a' });
        });
    });

    describe('multiple parameters', () => {
        test('a,b', () => {
            const src = 'a,b';
            preparse(src);

            expect(buf[PL_COUNT]).toBe(2);
            expect(getParam(buf, src, 0)).toEqual({ start: 0, end: 1, value: 'a' });
            expect(getParam(buf, src, 1)).toEqual({ start: 2, end: 3, value: 'b' });
        });

        test('a, b', () => {
            const src = 'a, b';
            preparse(src);

            expect(buf[PL_COUNT]).toBe(2);
            expect(getParam(buf, src, 0)).toEqual({ start: 0, end: 1, value: 'a' });
            expect(getParam(buf, src, 1)).toEqual({ start: 3, end: 4, value: 'b' });
        });

        test(' a , b  — whitespace around each param', () => {
            const src = ' a , b ';
            preparse(src);

            expect(buf[PL_COUNT]).toBe(2);
            expect(getParam(buf, src, 0)).toEqual({ start: 1, end: 2, value: 'a' });
            expect(getParam(buf, src, 1)).toEqual({ start: 5, end: 6, value: 'b' });
        });

        test('a,b,c', () => {
            const src = 'a,b,c';
            preparse(src);

            expect(buf[PL_COUNT]).toBe(3);
            expect(getParam(buf, src, 0)).toEqual({ start: 0, end: 1, value: 'a' });
            expect(getParam(buf, src, 1)).toEqual({ start: 2, end: 3, value: 'b' });
            expect(getParam(buf, src, 2)).toEqual({ start: 4, end: 5, value: 'c' });
        });
    });

    describe('null / empty parameters', () => {
        test(',b — leading null', () => {
            const src = ',b';
            preparse(src);

            expect(buf[PL_COUNT]).toBe(2);
            expect(getParam(buf, src, 0)).toBeNull();
            expect(getParam(buf, src, 1)).toEqual({ start: 1, end: 2, value: 'b' });
        });

        test('a, — trailing null', () => {
            const src = 'a,';
            preparse(src);

            expect(buf[PL_COUNT]).toBe(2);
            expect(getParam(buf, src, 0)).toEqual({ start: 0, end: 1, value: 'a' });
            expect(getParam(buf, src, 1)).toBeNull();
        });

        test(', — two nulls', () => {
            const src = ',';
            preparse(src);

            expect(buf[PL_COUNT]).toBe(2);
            expect(getParam(buf, src, 0)).toBeNull();
            expect(getParam(buf, src, 1)).toBeNull();
        });
    });

    describe('empty list', () => {
        test('empty string — zero params', () => {
            preparse('');

            expect(buf[PL_COUNT]).toBe(0);
            expect(buf[PL_LIST_START]).toBe(0);
            expect(buf[PL_LIST_END]).toBe(0);
        });
    });

    describe('list boundaries (passed by caller)', () => {
        test('list start/end are forwarded as-is from the caller', () => {
            // Simulate a caller that found `(hello,world)` at position 5 in a
            // larger source; it strips parens and passes listStart=6, listEnd=17.
            preparse('hello,world', 6, 17);

            expect(buf[PL_LIST_START]).toBe(6);
            expect(buf[PL_LIST_END]).toBe(17);
        });
    });
});
