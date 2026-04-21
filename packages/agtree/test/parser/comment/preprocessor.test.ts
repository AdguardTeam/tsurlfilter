import { describe, expect, test } from 'vitest';

import {
    CommentKind,
    CommentParser,
    createParserContext,
    initParserContext,
    PreprocessorCommentParser,
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

describe('PreprocessorCommentParser', () => {
    describe('classification', () => {
        test('!#endif', () => {
            parse('!#endif');
            expect(CommentParser.kind(ctx)).toBe(CommentKind.Preprocessor);
        });

        test('!#include ../sections/ads.txt', () => {
            parse('!#include ../sections/ads.txt');
            expect(CommentParser.kind(ctx)).toBe(CommentKind.Preprocessor);
        });

        test('!#if (adguard)', () => {
            parse('!#if (adguard)');
            expect(CommentParser.kind(ctx)).toBe(CommentKind.Preprocessor);
        });

        test('!#safari_cb_affinity(content_blockers)', () => {
            parse('!#safari_cb_affinity(content_blockers)');
            expect(CommentParser.kind(ctx)).toBe(CommentKind.Preprocessor);
        });
    });

    describe('directive name bounds', () => {
        test('!#endif — name at [2, 7)', () => {
            const source = '!#endif';
            const d = parse(source);
            expect(PreprocessorCommentParser.nameStart(d)).toBe(2);
            expect(PreprocessorCommentParser.nameEnd(d)).toBe(7);
            expect(source.slice(2, 7)).toBe('endif');
        });

        test('!#include ... — name at [2, 9)', () => {
            const source = '!#include ../sections/ads.txt';
            const d = parse(source);
            expect(PreprocessorCommentParser.nameStart(d)).toBe(2);
            expect(PreprocessorCommentParser.nameEnd(d)).toBe(9);
            expect(source.slice(2, 9)).toBe('include');
        });

        test('!#if (adguard) — name at [2, 4)', () => {
            const source = '!#if (adguard)';
            const d = parse(source);
            expect(PreprocessorCommentParser.nameStart(d)).toBe(2);
            expect(PreprocessorCommentParser.nameEnd(d)).toBe(4);
            expect(source.slice(2, 4)).toBe('if');
        });

        test('!#safari_cb_affinity(content_blockers) — name at [2, 20)', () => {
            const source = '!#safari_cb_affinity(content_blockers)';
            const d = parse(source);
            expect(PreprocessorCommentParser.nameStart(d)).toBe(2);
            expect(PreprocessorCommentParser.nameEnd(d)).toBe(20);
            expect(source.slice(2, 20)).toBe('safari_cb_affinity');
        });
    });

    describe('parameters bounds', () => {
        test('!#endif — no params', () => {
            const d = parse('!#endif');
            expect(PreprocessorCommentParser.paramsStart(d)).toBe(-1);
            expect(PreprocessorCommentParser.paramsEnd(d)).toBe(-1);
        });

        test('!#include ../sections/ads.txt — params at [10, 29)', () => {
            const source = '!#include ../sections/ads.txt';
            const d = parse(source);
            expect(PreprocessorCommentParser.paramsStart(d)).toBe(10);
            expect(PreprocessorCommentParser.paramsEnd(d)).toBe(29);
            expect(source.slice(10, 29)).toBe('../sections/ads.txt');
        });

        test('!#if (adguard) — params at [5, 14)', () => {
            const source = '!#if (adguard)';
            const d = parse(source);
            expect(PreprocessorCommentParser.paramsStart(d)).toBe(5);
            expect(PreprocessorCommentParser.paramsEnd(d)).toBe(14);
            expect(source.slice(5, 14)).toBe('(adguard)');
        });

        test('!#if      (adguard) — params after leading spaces at [10, 19)', () => {
            const source = '!#if      (adguard)';
            const d = parse(source);
            expect(PreprocessorCommentParser.paramsStart(d)).toBe(10);
            expect(PreprocessorCommentParser.paramsEnd(d)).toBe(19);
            expect(source.slice(10, 19)).toBe('(adguard)');
        });

        test('!#safari_cb_affinity(content_blockers) — params include parentheses at [20, 38)', () => {
            const source = '!#safari_cb_affinity(content_blockers)';
            const d = parse(source);
            expect(PreprocessorCommentParser.paramsStart(d)).toBe(20);
            expect(PreprocessorCommentParser.paramsEnd(d)).toBe(38);
            expect(source.slice(20, 38)).toBe('(content_blockers)');
        });
    });
});
