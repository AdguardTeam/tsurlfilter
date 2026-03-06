import { describe, test, expect } from 'vitest';

import { tokenizeLine } from '../../../src/tokenizer/tokenizer';
import type { TokenizeResult } from '../../../src/tokenizer/tokenizer';
import {
    createPreparserContext,
    initPreparserContext,
    SimpleCommentPreparser,
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

describe('SimpleCommentPreparser', () => {
    describe('classification', () => {
        // Starts with ! (not followed by # or +, which route to Preprocessor/Hint)
        test('!', () => {
            preparse('!');
            expect(CommentClassifier.kind(ctx)).toBe(CommentKind.Simple);
        });

        test('!!', () => {
            preparse('!!');
            expect(CommentClassifier.kind(ctx)).toBe(CommentKind.Simple);
        });

        test('!comment', () => {
            preparse('!comment');
            expect(CommentClassifier.kind(ctx)).toBe(CommentKind.Simple);
        });

        test('! comment', () => {
            preparse('! comment');
            expect(CommentClassifier.kind(ctx)).toBe(CommentKind.Simple);
        });

        // Starts with # (NOTE: '!+...' is CommentKind.Hint, '!#...' is CommentKind.Preprocessor)
        test('#', () => {
            preparse('#');
            expect(CommentClassifier.kind(ctx)).toBe(CommentKind.Simple);
        });

        test('##', () => {
            preparse('##');
            expect(CommentClassifier.kind(ctx)).toBe(CommentKind.Simple);
        });

        test('# #', () => {
            preparse('# #');
            expect(CommentClassifier.kind(ctx)).toBe(CommentKind.Simple);
        });

        test('#comment', () => {
            preparse('#comment');
            expect(CommentClassifier.kind(ctx)).toBe(CommentKind.Simple);
        });

        test('##########################', () => {
            preparse('##########################');
            expect(CommentClassifier.kind(ctx)).toBe(CommentKind.Simple);
        });
    });

    describe('marker position', () => {
        test('! This is just a comment — marker at 0', () => {
            expect(SimpleCommentPreparser.markerStart(preparse('! This is just a comment'))).toBe(0);
        });

        test('# This is just a comment — marker at 0', () => {
            expect(SimpleCommentPreparser.markerStart(preparse('# This is just a comment'))).toBe(0);
        });

        test('########################## — marker at 0', () => {
            expect(SimpleCommentPreparser.markerStart(preparse('##########################'))).toBe(0);
        });

        test('!comment — marker at 0', () => {
            expect(SimpleCommentPreparser.markerStart(preparse('!comment'))).toBe(0);
        });

        test('#comment — marker at 0', () => {
            expect(SimpleCommentPreparser.markerStart(preparse('#comment'))).toBe(0);
        });
    });

    describe('text bounds', () => {
        test('! This is just a comment — text after leading space', () => {
            const source = '! This is just a comment';
            const d = preparse(source);
            // Leading space after ! is skipped; text starts at 2 ('T')
            expect(SimpleCommentPreparser.textStart(d)).toBe(2);
            expect(SimpleCommentPreparser.textEnd(d)).toBe(source.length);
        });

        test('# This is just a comment — text after leading space', () => {
            const source = '# This is just a comment';
            const d = preparse(source);
            expect(SimpleCommentPreparser.textStart(d)).toBe(2);
            expect(SimpleCommentPreparser.textEnd(d)).toBe(source.length);
        });

        test('!comment — no space, text starts at 1', () => {
            const source = '!comment';
            const d = preparse(source);
            expect(SimpleCommentPreparser.textStart(d)).toBe(1);
            expect(SimpleCommentPreparser.textEnd(d)).toBe(source.length);
        });

        test('########################## — second # is text start', () => {
            const source = '##########################';
            const d = preparse(source);
            expect(SimpleCommentPreparser.textStart(d)).toBe(1);
            expect(SimpleCommentPreparser.textEnd(d)).toBe(source.length);
        });

        test('! #########################', () => {
            const source = '! #########################';
            const d = preparse(source);
            // Leading space after ! is skipped; text starts at 2 (first #)
            expect(SimpleCommentPreparser.textStart(d)).toBe(2);
            expect(SimpleCommentPreparser.textEnd(d)).toBe(source.length);
        });

        test('trailing whitespace trimmed from text end', () => {
            const source = '! hello   ';
            const d = preparse(source);
            expect(SimpleCommentPreparser.textStart(d)).toBe(2);
            // Trailing spaces are trimmed
            expect(SimpleCommentPreparser.textEnd(d)).toBe(7); // end of 'hello'
        });
    });
});
