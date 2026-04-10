import { describe, expect, test } from 'vitest';

import { cssIdentSequenceLength } from '../../../src/css/tokenizer/css-token-mapping';

import { tokenizeSource } from './helpers/test-utils';

describe('cssIdentSequenceLength', () => {
    test('simple letter identifier', () => {
        const r = tokenizeSource('abc');
        expect(cssIdentSequenceLength(r.types, 0, r.tokenCount, r.source, r.ends, 0)).toBe(1);
    });

    test('letter + digit identifier', () => {
        const r = tokenizeSource('a1');
        expect(cssIdentSequenceLength(r.types, 0, r.tokenCount, r.source, r.ends, 0)).toBe(2);
    });

    test('hyphen + letter identifier', () => {
        const r = tokenizeSource('-abc');
        expect(cssIdentSequenceLength(r.types, 0, r.tokenCount, r.source, r.ends, 0)).toBe(2);
    });

    test('double-hyphen identifier (custom property prefix)', () => {
        const r = tokenizeSource('--foo');
        expect(cssIdentSequenceLength(r.types, 0, r.tokenCount, r.source, r.ends, 0)).toBe(3);
    });

    test('underscore identifier', () => {
        const r = tokenizeSource('_test');
        expect(cssIdentSequenceLength(r.types, 0, r.tokenCount, r.source, r.ends, 0)).toBe(2);
    });

    test('identifier with escaped char', () => {
        const r = tokenizeSource('a\\!b');
        // tokens: Letter(a), Escaped(\!), Letter(b)
        expect(cssIdentSequenceLength(r.types, 0, r.tokenCount, r.source, r.ends, 0)).toBe(3);
    });

    test('identifier starting with escape', () => {
        const r = tokenizeSource('\\61 bc');
        // Escaped(\6), Digit(1), Whitespace( ), Letter(bc)
        // The escape consumes: Escaped + Digit(1) + Whitespace = 3 tokens
        // Then Letter(bc) = 1 more ident token
        const len = cssIdentSequenceLength(r.types, 0, r.tokenCount, r.source, r.ends, 0);
        expect(len).toBeGreaterThanOrEqual(2);
    });

    test('identifier with hex escape', () => {
        const r = tokenizeSource('\\41 B');
        // Escaped(\4), Digit(1), Whitespace( ), Letter(B)
        // Hex escape consumes: Escaped + Digit + Whitespace = 3 tokens
        // Then Letter(B) is ident continuation
        const len = cssIdentSequenceLength(r.types, 0, r.tokenCount, r.source, r.ends, 0);
        expect(len).toBeGreaterThanOrEqual(2);
    });

    test('returns 0 for digit start', () => {
        const r = tokenizeSource('123');
        expect(cssIdentSequenceLength(r.types, 0, r.tokenCount, r.source, r.ends, 0)).toBe(0);
    });

    test('returns 0 for dot', () => {
        const r = tokenizeSource('.foo');
        expect(cssIdentSequenceLength(r.types, 0, r.tokenCount, r.source, r.ends, 0)).toBe(0);
    });

    test('returns 0 at end of tokens', () => {
        const r = tokenizeSource('abc');
        expect(cssIdentSequenceLength(r.types, r.tokenCount, r.tokenCount, r.source, r.ends, 0)).toBe(0);
    });

    test('hyphen alone is not an ident', () => {
        const r = tokenizeSource('- ');
        expect(cssIdentSequenceLength(r.types, 0, r.tokenCount, r.source, r.ends, 0)).toBe(0);
    });

    test('hyphen + digit is not an ident', () => {
        const r = tokenizeSource('-1');
        expect(cssIdentSequenceLength(r.types, 0, r.tokenCount, r.source, r.ends, 0)).toBe(0);
    });

    test('hyphen + escape starts ident', () => {
        const r = tokenizeSource('-\\!x');
        // Hyphen, Escaped(\!), Letter(x)
        expect(cssIdentSequenceLength(r.types, 0, r.tokenCount, r.source, r.ends, 0)).toBe(3);
    });

    test('respects offset parameter', () => {
        const r = tokenizeSource('.abc');
        // tokens: Dot, Letter(abc)
        expect(cssIdentSequenceLength(r.types, 1, r.tokenCount, r.source, r.ends, 0)).toBe(1);
    });

    test('CSS custom property --color', () => {
        const r = tokenizeSource('--color');
        expect(cssIdentSequenceLength(r.types, 0, r.tokenCount, r.source, r.ends, 0)).toBe(3);
    });
});
