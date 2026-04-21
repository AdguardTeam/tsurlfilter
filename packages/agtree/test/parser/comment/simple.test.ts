import { describe, expect, test } from 'vitest';

import {
    CommentKind,
    CommentParser,
    createParserContext,
    initParserContext,
    SimpleCommentParser,
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

describe('SimpleCommentParser', () => {
    describe('classification', () => {
        // Starts with ! (not followed by # or +, which route to Preprocessor/Hint)
        test('!', () => {
            parse('!');
            expect(CommentParser.kind(ctx)).toBe(CommentKind.Simple);
        });

        test('!!', () => {
            parse('!!');
            expect(CommentParser.kind(ctx)).toBe(CommentKind.Simple);
        });

        test('!comment', () => {
            parse('!comment');
            expect(CommentParser.kind(ctx)).toBe(CommentKind.Simple);
        });

        test('! comment', () => {
            parse('! comment');
            expect(CommentParser.kind(ctx)).toBe(CommentKind.Simple);
        });

        // Starts with # (NOTE: '!+...' is CommentKind.Hint, '!#...' is CommentKind.Preprocessor)
        test('#', () => {
            parse('#');
            expect(CommentParser.kind(ctx)).toBe(CommentKind.Simple);
        });

        test('##', () => {
            parse('##');
            expect(CommentParser.kind(ctx)).toBe(CommentKind.Simple);
        });

        test('# #', () => {
            parse('# #');
            expect(CommentParser.kind(ctx)).toBe(CommentKind.Simple);
        });

        test('#comment', () => {
            parse('#comment');
            expect(CommentParser.kind(ctx)).toBe(CommentKind.Simple);
        });

        test('##########################', () => {
            parse('##########################');
            expect(CommentParser.kind(ctx)).toBe(CommentKind.Simple);
        });
    });

    describe('marker position', () => {
        test('! This is just a comment — marker at 0', () => {
            expect(SimpleCommentParser.markerStart(parse('! This is just a comment'))).toBe(0);
        });

        test('# This is just a comment — marker at 0', () => {
            expect(SimpleCommentParser.markerStart(parse('# This is just a comment'))).toBe(0);
        });

        test('########################## — marker at 0', () => {
            expect(SimpleCommentParser.markerStart(parse('##########################'))).toBe(0);
        });

        test('!comment — marker at 0', () => {
            expect(SimpleCommentParser.markerStart(parse('!comment'))).toBe(0);
        });

        test('#comment — marker at 0', () => {
            expect(SimpleCommentParser.markerStart(parse('#comment'))).toBe(0);
        });
    });

    describe('text bounds', () => {
        test('! This is just a comment — text after leading space', () => {
            const source = '! This is just a comment';
            const d = parse(source);
            // Leading space after ! is skipped; text starts at 2 ('T')
            expect(SimpleCommentParser.textStart(d)).toBe(2);
            expect(SimpleCommentParser.textEnd(d)).toBe(source.length);
        });

        test('# This is just a comment — text after leading space', () => {
            const source = '# This is just a comment';
            const d = parse(source);
            expect(SimpleCommentParser.textStart(d)).toBe(2);
            expect(SimpleCommentParser.textEnd(d)).toBe(source.length);
        });

        test('!comment — no space, text starts at 1', () => {
            const source = '!comment';
            const d = parse(source);
            expect(SimpleCommentParser.textStart(d)).toBe(1);
            expect(SimpleCommentParser.textEnd(d)).toBe(source.length);
        });

        test('########################## — second # is text start', () => {
            const source = '##########################';
            const d = parse(source);
            expect(SimpleCommentParser.textStart(d)).toBe(1);
            expect(SimpleCommentParser.textEnd(d)).toBe(source.length);
        });

        test('! #########################', () => {
            const source = '! #########################';
            const d = parse(source);
            // Leading space after ! is skipped; text starts at 2 (first #)
            expect(SimpleCommentParser.textStart(d)).toBe(2);
            expect(SimpleCommentParser.textEnd(d)).toBe(source.length);
        });

        test('trailing whitespace trimmed from text end', () => {
            const source = '! hello   ';
            const d = parse(source);
            expect(SimpleCommentParser.textStart(d)).toBe(2);
            // Trailing spaces are trimmed
            expect(SimpleCommentParser.textEnd(d)).toBe(7); // end of 'hello'
        });
    });
});
