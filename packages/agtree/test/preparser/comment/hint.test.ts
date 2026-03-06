import { describe, test, expect } from 'vitest';

import { tokenizeLine } from '../../../src/tokenizer/tokenizer';
import type { TokenizeResult } from '../../../src/tokenizer/tokenizer';
import {
    createPreparserContext,
    initPreparserContext,
    HintCommentPreparser,
    CommentClassifier,
    CommentKind,
} from '../../../src/preparser';

const tokenResult: TokenizeResult = {
    tokenCount: 0,
    types: new Uint8Array(1024),
    ends: new Uint32Array(1024),
    actualEnd: 0,
    overflowed: 0,
};

const ctx = createPreparserContext();

/**
 * Tokenize + preparse a comment rule in one step for convenience.
 *
 * @param source - Source string to preparse.
 * @returns Preparsed data buffer.
 */
function preparse(source: string): Int32Array {
    tokenizeLine(source, 0, tokenResult);
    initPreparserContext(ctx, source, tokenResult);
    CommentClassifier.preparse(ctx);
    return ctx.data;
}

describe('HintCommentPreparser', () => {
    describe('classification', () => {
        test('!+NOT_OPTIMIZED', () => {
            preparse('!+NOT_OPTIMIZED');
            expect(CommentClassifier.kind(ctx)).toBe(CommentKind.Hint);
        });

        test('!+ NOT_OPTIMIZED — space after marker', () => {
            preparse('!+ NOT_OPTIMIZED');
            expect(CommentClassifier.kind(ctx)).toBe(CommentKind.Hint);
        });

        test('!+ HINT_NAME1 HINT_NAME2 — multiple hints', () => {
            preparse('!+ HINT_NAME1 HINT_NAME2');
            expect(CommentClassifier.kind(ctx)).toBe(CommentKind.Hint);
        });

        test('!+ HINT_NAME1(param0, param1) — with params', () => {
            preparse('!+ HINT_NAME1(param0, param1)');
            expect(CommentClassifier.kind(ctx)).toBe(CommentKind.Hint);
        });
    });

    describe('count', () => {
        test('!+NOT_OPTIMIZED → 1', () => {
            expect(HintCommentPreparser.count(preparse('!+NOT_OPTIMIZED'))).toBe(1);
        });

        test('!+ NOT_OPTIMIZED → 1', () => {
            expect(HintCommentPreparser.count(preparse('!+ NOT_OPTIMIZED'))).toBe(1);
        });

        test('!+ HINT_NAME1 HINT_NAME2 → 2', () => {
            expect(HintCommentPreparser.count(preparse('!+ HINT_NAME1 HINT_NAME2'))).toBe(2);
        });

        test('!+ HINT_NAME1() HINT_NAME2() → 2', () => {
            expect(HintCommentPreparser.count(preparse('!+ HINT_NAME1() HINT_NAME2()'))).toBe(2);
        });

        test('!+ HINT_NAME1(param0, param1) HINT_NAME2(param0) → 2', () => {
            const d = preparse('!+ HINT_NAME1(param0, param1) HINT_NAME2(param0)');
            expect(HintCommentPreparser.count(d)).toBe(2);
        });
    });

    describe('hint name bounds — no params', () => {
        test('!+NOT_OPTIMIZED — name at [2, 15)', () => {
            const d = preparse('!+NOT_OPTIMIZED');
            expect(HintCommentPreparser.hintNameStart(d, 0)).toBe(2);
            expect(HintCommentPreparser.hintNameEnd(d, 0)).toBe(15);
        });

        test('!+ NOT_OPTIMIZED — name at [3, 16)', () => {
            const d = preparse('!+ NOT_OPTIMIZED');
            expect(HintCommentPreparser.hintNameStart(d, 0)).toBe(3);
            expect(HintCommentPreparser.hintNameEnd(d, 0)).toBe(16);
        });

        test('!+ HINT_NAME1 HINT_NAME2 — two names', () => {
            const d = preparse('!+ HINT_NAME1 HINT_NAME2');
            expect(HintCommentPreparser.hintNameStart(d, 0)).toBe(3);
            expect(HintCommentPreparser.hintNameEnd(d, 0)).toBe(13);
            expect(HintCommentPreparser.hintNameStart(d, 1)).toBe(14);
            expect(HintCommentPreparser.hintNameEnd(d, 1)).toBe(24);
        });

        test('!+NOT_OPTIMIZED — no params', () => {
            const d = preparse('!+NOT_OPTIMIZED');
            expect(HintCommentPreparser.hintParamsStart(d, 0)).toBe(-1);
            expect(HintCommentPreparser.hintParamsEnd(d, 0)).toBe(-1);
        });
    });

    describe('hint name + params bounds', () => {
        test('!+ HINT_NAME1() — name at [3, 13), empty params [13, 15)', () => {
            const d = preparse('!+ HINT_NAME1()');
            expect(HintCommentPreparser.hintNameStart(d, 0)).toBe(3);
            expect(HintCommentPreparser.hintNameEnd(d, 0)).toBe(13);
            expect(HintCommentPreparser.hintParamsStart(d, 0)).toBe(13);
            expect(HintCommentPreparser.hintParamsEnd(d, 0)).toBe(15);
        });

        test('!+ HINT_NAME1(param0, param1) HINT_NAME2(param0)', () => {
            const source = '!+ HINT_NAME1(param0, param1) HINT_NAME2(param0)';
            const d = preparse(source);
            // hint[0]: HINT_NAME1 at [3, 13), params (param0, param1) at [13, 29)
            expect(HintCommentPreparser.hintNameStart(d, 0)).toBe(3);
            expect(HintCommentPreparser.hintNameEnd(d, 0)).toBe(13);
            expect(HintCommentPreparser.hintParamsStart(d, 0)).toBe(13);
            expect(HintCommentPreparser.hintParamsEnd(d, 0)).toBe(29);
            // hint[1]: HINT_NAME2 at [30, 40), params (param0) at [40, 48)
            expect(HintCommentPreparser.hintNameStart(d, 1)).toBe(30);
            expect(HintCommentPreparser.hintNameEnd(d, 1)).toBe(40);
            expect(HintCommentPreparser.hintParamsStart(d, 1)).toBe(40);
            expect(HintCommentPreparser.hintParamsEnd(d, 1)).toBe(48);
        });

        test('!+ HINT_NAME1() HINT_NAME2() — two empty param lists', () => {
            const source = '!+ HINT_NAME1() HINT_NAME2()';
            const d = preparse(source);
            expect(HintCommentPreparser.hintParamsStart(d, 0)).toBe(13);
            expect(HintCommentPreparser.hintParamsEnd(d, 0)).toBe(15);
            expect(HintCommentPreparser.hintParamsStart(d, 1)).toBe(26);
            expect(HintCommentPreparser.hintParamsEnd(d, 1)).toBe(28);
        });
    });
});
