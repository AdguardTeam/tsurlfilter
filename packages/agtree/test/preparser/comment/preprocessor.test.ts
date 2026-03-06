import { describe, test, expect } from 'vitest';

import { tokenizeLine } from '../../../src/tokenizer/tokenizer';
import type { TokenizeResult } from '../../../src/tokenizer/tokenizer';
import {
    createPreparserContext,
    initPreparserContext,
    PreprocessorCommentPreparser,
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

describe('PreprocessorCommentPreparser', () => {
    describe('classification', () => {
        test('!#endif', () => {
            preparse('!#endif');
            expect(CommentClassifier.kind(ctx)).toBe(CommentKind.Preprocessor);
        });

        test('!#include ../sections/ads.txt', () => {
            preparse('!#include ../sections/ads.txt');
            expect(CommentClassifier.kind(ctx)).toBe(CommentKind.Preprocessor);
        });

        test('!#if (adguard)', () => {
            preparse('!#if (adguard)');
            expect(CommentClassifier.kind(ctx)).toBe(CommentKind.Preprocessor);
        });

        test('!#safari_cb_affinity(content_blockers)', () => {
            preparse('!#safari_cb_affinity(content_blockers)');
            expect(CommentClassifier.kind(ctx)).toBe(CommentKind.Preprocessor);
        });
    });

    describe('directive name bounds', () => {
        test('!#endif — name at [2, 7)', () => {
            const source = '!#endif';
            const d = preparse(source);
            expect(PreprocessorCommentPreparser.nameStart(d)).toBe(2);
            expect(PreprocessorCommentPreparser.nameEnd(d)).toBe(7);
            expect(source.slice(2, 7)).toBe('endif');
        });

        test('!#include ... — name at [2, 9)', () => {
            const source = '!#include ../sections/ads.txt';
            const d = preparse(source);
            expect(PreprocessorCommentPreparser.nameStart(d)).toBe(2);
            expect(PreprocessorCommentPreparser.nameEnd(d)).toBe(9);
            expect(source.slice(2, 9)).toBe('include');
        });

        test('!#if (adguard) — name at [2, 4)', () => {
            const source = '!#if (adguard)';
            const d = preparse(source);
            expect(PreprocessorCommentPreparser.nameStart(d)).toBe(2);
            expect(PreprocessorCommentPreparser.nameEnd(d)).toBe(4);
            expect(source.slice(2, 4)).toBe('if');
        });

        test('!#safari_cb_affinity(content_blockers) — name at [2, 20)', () => {
            const source = '!#safari_cb_affinity(content_blockers)';
            const d = preparse(source);
            expect(PreprocessorCommentPreparser.nameStart(d)).toBe(2);
            expect(PreprocessorCommentPreparser.nameEnd(d)).toBe(20);
            expect(source.slice(2, 20)).toBe('safari_cb_affinity');
        });
    });

    describe('parameters bounds', () => {
        test('!#endif — no params', () => {
            const d = preparse('!#endif');
            expect(PreprocessorCommentPreparser.paramsStart(d)).toBe(-1);
            expect(PreprocessorCommentPreparser.paramsEnd(d)).toBe(-1);
        });

        test('!#include ../sections/ads.txt — params at [10, 29)', () => {
            const source = '!#include ../sections/ads.txt';
            const d = preparse(source);
            expect(PreprocessorCommentPreparser.paramsStart(d)).toBe(10);
            expect(PreprocessorCommentPreparser.paramsEnd(d)).toBe(29);
            expect(source.slice(10, 29)).toBe('../sections/ads.txt');
        });

        test('!#if (adguard) — params at [5, 14)', () => {
            const source = '!#if (adguard)';
            const d = preparse(source);
            expect(PreprocessorCommentPreparser.paramsStart(d)).toBe(5);
            expect(PreprocessorCommentPreparser.paramsEnd(d)).toBe(14);
            expect(source.slice(5, 14)).toBe('(adguard)');
        });

        test('!#if      (adguard) — params after leading spaces at [10, 19)', () => {
            const source = '!#if      (adguard)';
            const d = preparse(source);
            expect(PreprocessorCommentPreparser.paramsStart(d)).toBe(10);
            expect(PreprocessorCommentPreparser.paramsEnd(d)).toBe(19);
            expect(source.slice(10, 19)).toBe('(adguard)');
        });

        test('!#safari_cb_affinity(content_blockers) — params include parentheses at [20, 38)', () => {
            const source = '!#safari_cb_affinity(content_blockers)';
            const d = preparse(source);
            expect(PreprocessorCommentPreparser.paramsStart(d)).toBe(20);
            expect(PreprocessorCommentPreparser.paramsEnd(d)).toBe(38);
            expect(source.slice(20, 38)).toBe('(content_blockers)');
        });
    });
});
