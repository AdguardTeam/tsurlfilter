import { describe, expect, test } from 'vitest';

import { cssCommentLength } from '../../../src/css/tokenizer/css-token-mapping';

import { tokenizeSource } from './helpers/test-utils';

describe('cssCommentLength', () => {
    test('simple comment /* x */', () => {
        const r = tokenizeSource('/* x */');
        const len = cssCommentLength(r.types, 0, r.tokenCount);
        expect(len).toBeGreaterThan(0);
        // Should consume all tokens
        expect(len).toBe(r.tokenCount);
    });

    test('empty comment /**/', () => {
        const r = tokenizeSource('/**/');
        const len = cssCommentLength(r.types, 0, r.tokenCount);
        expect(len).toBe(r.tokenCount);
    });

    test('comment with multiple asterisks /***/', () => {
        const r = tokenizeSource('/***/');
        const len = cssCommentLength(r.types, 0, r.tokenCount);
        expect(len).toBe(r.tokenCount);
    });

    test('unterminated comment /* no close', () => {
        const r = tokenizeSource('/* no close');
        const len = cssCommentLength(r.types, 0, r.tokenCount);
        // Unterminated comment consumes all tokens
        expect(len).toBe(r.tokenCount);
    });

    test('returns 0 for non-comment (just slash)', () => {
        const r = tokenizeSource('/x');
        expect(cssCommentLength(r.types, 0, r.tokenCount)).toBe(0);
    });

    test('returns 0 for non-comment (just asterisk)', () => {
        const r = tokenizeSource('*x');
        expect(cssCommentLength(r.types, 0, r.tokenCount)).toBe(0);
    });

    test('comment followed by other tokens', () => {
        const r = tokenizeSource('/* c */abc');
        const len = cssCommentLength(r.types, 0, r.tokenCount);
        // Comment should not consume the abc part
        expect(len).toBeLessThan(r.tokenCount);
        expect(len).toBeGreaterThan(0);
    });

    test('returns 0 at end of tokens', () => {
        const r = tokenizeSource('abc');
        expect(cssCommentLength(r.types, r.tokenCount, r.tokenCount)).toBe(0);
    });

    test('multiline comment', () => {
        const r = tokenizeSource('/* line1\nline2 */');
        const len = cssCommentLength(r.types, 0, r.tokenCount);
        expect(len).toBe(r.tokenCount);
    });
});
