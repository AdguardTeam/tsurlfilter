import { describe, expect, test } from 'vitest';

import { cssStringLength } from '../../../src/css/tokenizer/css-token-mapping';

import { tokenizeSource } from './helpers/test-utils';

describe('cssStringLength', () => {
    test('double-quoted string', () => {
        const r = tokenizeSource('"hello"');
        const len = cssStringLength(r.types, 0, r.tokenCount);
        expect(len).toBe(r.tokenCount);
    });

    test('single-quoted string', () => {
        const r = tokenizeSource("'hello'");
        const len = cssStringLength(r.types, 0, r.tokenCount);
        expect(len).toBe(r.tokenCount);
    });

    test('empty double-quoted string', () => {
        const r = tokenizeSource('""');
        const len = cssStringLength(r.types, 0, r.tokenCount);
        expect(len).toBe(r.tokenCount);
    });

    test('empty single-quoted string', () => {
        const r = tokenizeSource("''");
        const len = cssStringLength(r.types, 0, r.tokenCount);
        expect(len).toBe(r.tokenCount);
    });

    test('string with escaped quote', () => {
        const r = tokenizeSource('"he\\"llo"');
        const len = cssStringLength(r.types, 0, r.tokenCount);
        expect(len).toBe(r.tokenCount);
    });

    test('string with escaped backslash', () => {
        const r = tokenizeSource('"he\\\\llo"');
        const len = cssStringLength(r.types, 0, r.tokenCount);
        expect(len).toBe(r.tokenCount);
    });

    test('bad-string: newline inside string', () => {
        const r = tokenizeSource('"hello\nworld"');
        const len = cssStringLength(r.types, 0, r.tokenCount);
        // Should consume up to and including the newline
        expect(len).toBeGreaterThan(0);
        expect(len).toBeLessThan(r.tokenCount);
    });

    test('unterminated string at EOF', () => {
        const r = tokenizeSource('"hello');
        const len = cssStringLength(r.types, 0, r.tokenCount);
        expect(len).toBe(r.tokenCount);
    });

    test('returns 0 for non-string start', () => {
        const r = tokenizeSource('abc');
        expect(cssStringLength(r.types, 0, r.tokenCount)).toBe(0);
    });

    test('returns 0 at end of tokens', () => {
        const r = tokenizeSource('x');
        expect(cssStringLength(r.types, r.tokenCount, r.tokenCount)).toBe(0);
    });

    test('string followed by other tokens', () => {
        const r = tokenizeSource('"x"abc');
        const len = cssStringLength(r.types, 0, r.tokenCount);
        expect(len).toBeGreaterThan(0);
        expect(len).toBeLessThan(r.tokenCount);
    });

    test('string with numbers inside', () => {
        const r = tokenizeSource('"123"');
        const len = cssStringLength(r.types, 0, r.tokenCount);
        expect(len).toBe(r.tokenCount);
    });

    test('string with spaces inside', () => {
        const r = tokenizeSource('"a b c"');
        const len = cssStringLength(r.types, 0, r.tokenCount);
        expect(len).toBe(r.tokenCount);
    });

    test('escape followed by newline is detected as bad-string (no double-advance on Escaped)', () => {
        // Source (6 chars): " x \ " LF "
        // Tokens: Quote, Letter(x), Escaped(\"), LineBreak(\n), Quote  — 5 tokens
        // The Escaped token must NOT skip the LineBreak on the next iteration.
        // Correct: bad-string span = 4 (stops at + includes LineBreak at index 3).
        const r = tokenizeSource('"x\\"\n"');
        const len = cssStringLength(r.types, 0, r.tokenCount);
        expect(len).toBe(4);
    });
});
