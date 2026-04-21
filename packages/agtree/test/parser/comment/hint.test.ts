import { describe, expect, test } from 'vitest';

import {
    CommentKind,
    CommentParser,
    createParserContext,
    HintCommentParser,
    initParserContext,
} from '../../../src/parser';
import { Tokenizer } from '../../../src/tokenizer/tokenizer';

const tokenizer = new Tokenizer(1024);

const ctx = createParserContext();

/**
 * Tokenize + parse a comment rule in one step for convenience.
 *
 * @param source Source string to parse.
 *
 * @returns Preparsed data buffer.
 */
function parse(source: string): Int32Array {
    tokenizer.setSource(source);
    initParserContext(ctx, source, tokenizer);
    CommentParser.parse(ctx);
    return ctx.data;
}

describe('HintCommentParser', () => {
    describe('classification', () => {
        test('!+NOT_OPTIMIZED', () => {
            parse('!+NOT_OPTIMIZED');
            expect(CommentParser.kind(ctx)).toBe(CommentKind.Hint);
        });

        test('!+ NOT_OPTIMIZED — space after marker', () => {
            parse('!+ NOT_OPTIMIZED');
            expect(CommentParser.kind(ctx)).toBe(CommentKind.Hint);
        });

        test('!+ HINT_NAME1 HINT_NAME2 — multiple hints', () => {
            parse('!+ HINT_NAME1 HINT_NAME2');
            expect(CommentParser.kind(ctx)).toBe(CommentKind.Hint);
        });

        test('!+ HINT_NAME1(param0, param1) — with params', () => {
            parse('!+ HINT_NAME1(param0, param1)');
            expect(CommentParser.kind(ctx)).toBe(CommentKind.Hint);
        });
    });

    describe('count', () => {
        test('!+NOT_OPTIMIZED → 1', () => {
            expect(HintCommentParser.count(parse('!+NOT_OPTIMIZED'))).toBe(1);
        });

        test('!+ NOT_OPTIMIZED → 1', () => {
            expect(HintCommentParser.count(parse('!+ NOT_OPTIMIZED'))).toBe(1);
        });

        test('!+ HINT_NAME1 HINT_NAME2 → 2', () => {
            expect(HintCommentParser.count(parse('!+ HINT_NAME1 HINT_NAME2'))).toBe(2);
        });

        test('!+ HINT_NAME1() HINT_NAME2() → 2', () => {
            expect(HintCommentParser.count(parse('!+ HINT_NAME1() HINT_NAME2()'))).toBe(2);
        });

        test('!+ HINT_NAME1(param0, param1) HINT_NAME2(param0) → 2', () => {
            const d = parse('!+ HINT_NAME1(param0, param1) HINT_NAME2(param0)');
            expect(HintCommentParser.count(d)).toBe(2);
        });
    });

    describe('hint name bounds — no params', () => {
        test('!+NOT_OPTIMIZED — name at [2, 15)', () => {
            const d = parse('!+NOT_OPTIMIZED');
            expect(HintCommentParser.hintNameStart(d, 0)).toBe(2);
            expect(HintCommentParser.hintNameEnd(d, 0)).toBe(15);
        });

        test('!+ NOT_OPTIMIZED — name at [3, 16)', () => {
            const d = parse('!+ NOT_OPTIMIZED');
            expect(HintCommentParser.hintNameStart(d, 0)).toBe(3);
            expect(HintCommentParser.hintNameEnd(d, 0)).toBe(16);
        });

        test('!+ HINT_NAME1 HINT_NAME2 — two names', () => {
            const d = parse('!+ HINT_NAME1 HINT_NAME2');
            expect(HintCommentParser.hintNameStart(d, 0)).toBe(3);
            expect(HintCommentParser.hintNameEnd(d, 0)).toBe(13);
            expect(HintCommentParser.hintNameStart(d, 1)).toBe(14);
            expect(HintCommentParser.hintNameEnd(d, 1)).toBe(24);
        });

        test('!+NOT_OPTIMIZED — no params', () => {
            const d = parse('!+NOT_OPTIMIZED');
            expect(HintCommentParser.hintParamsStart(d, 0)).toBe(-1);
            expect(HintCommentParser.hintParamsEnd(d, 0)).toBe(-1);
        });
    });

    describe('hint name + params bounds', () => {
        test('!+ HINT_NAME1() — name at [3, 13), empty params [13, 15)', () => {
            const d = parse('!+ HINT_NAME1()');
            expect(HintCommentParser.hintNameStart(d, 0)).toBe(3);
            expect(HintCommentParser.hintNameEnd(d, 0)).toBe(13);
            expect(HintCommentParser.hintParamsStart(d, 0)).toBe(13);
            expect(HintCommentParser.hintParamsEnd(d, 0)).toBe(15);
        });

        test('!+ HINT_NAME1(param0, param1) HINT_NAME2(param0)', () => {
            const source = '!+ HINT_NAME1(param0, param1) HINT_NAME2(param0)';
            const d = parse(source);
            // hint[0]: HINT_NAME1 at [3, 13), params (param0, param1) at [13, 29)
            expect(HintCommentParser.hintNameStart(d, 0)).toBe(3);
            expect(HintCommentParser.hintNameEnd(d, 0)).toBe(13);
            expect(HintCommentParser.hintParamsStart(d, 0)).toBe(13);
            expect(HintCommentParser.hintParamsEnd(d, 0)).toBe(29);
            // hint[1]: HINT_NAME2 at [30, 40), params (param0) at [40, 48)
            expect(HintCommentParser.hintNameStart(d, 1)).toBe(30);
            expect(HintCommentParser.hintNameEnd(d, 1)).toBe(40);
            expect(HintCommentParser.hintParamsStart(d, 1)).toBe(40);
            expect(HintCommentParser.hintParamsEnd(d, 1)).toBe(48);
        });

        test('!+ HINT_NAME1() HINT_NAME2() — two empty param lists', () => {
            const source = '!+ HINT_NAME1() HINT_NAME2()';
            const d = parse(source);
            expect(HintCommentParser.hintParamsStart(d, 0)).toBe(13);
            expect(HintCommentParser.hintParamsEnd(d, 0)).toBe(15);
            expect(HintCommentParser.hintParamsStart(d, 1)).toBe(26);
            expect(HintCommentParser.hintParamsEnd(d, 1)).toBe(28);
        });
    });
});
