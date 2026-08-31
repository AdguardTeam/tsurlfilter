import { describe, expect, test } from 'vitest';

import { cssNumberLength } from '../../../src/css/tokenizer/css-token-mapping';

import { tokenizeSource } from './helpers/test-utils';

describe('cssNumberLength', () => {
    test('integer', () => {
        const r = tokenizeSource('42');
        expect(cssNumberLength(r.types, 0, r.tokenCount, r.source, r.ends, 0)).toBe(1);
    });

    test('decimal', () => {
        const r = tokenizeSource('3.14');
        expect(cssNumberLength(r.types, 0, r.tokenCount, r.source, r.ends, 0)).toBe(3);
    });

    test('leading dot', () => {
        const r = tokenizeSource('.5');
        expect(cssNumberLength(r.types, 0, r.tokenCount, r.source, r.ends, 0)).toBe(2);
    });

    test('positive sign', () => {
        const r = tokenizeSource('+3');
        expect(cssNumberLength(r.types, 0, r.tokenCount, r.source, r.ends, 0)).toBe(2);
    });

    test('negative sign', () => {
        const r = tokenizeSource('-3');
        // Hyphen + Digit
        expect(cssNumberLength(r.types, 0, r.tokenCount, r.source, r.ends, 0)).toBe(2);
    });

    test('number with exponent', () => {
        const r = tokenizeSource('1e2');
        // Digit(1), Letter(e), Digit(2) — but 'e' must be a single Letter token
        // The tokenizer groups letters, so 'e' is Letter('e'), then Digit('2')
        // Actually '1e2' → tokenizer sees: Digit('1'), Letter('e'), Digit('2')
        const len = cssNumberLength(r.types, 0, r.tokenCount, r.source, r.ends, 0);
        expect(len).toBe(3);
    });

    test('number with uppercase exponent', () => {
        const r = tokenizeSource('1E2');
        const len = cssNumberLength(r.types, 0, r.tokenCount, r.source, r.ends, 0);
        expect(len).toBe(3);
    });

    test('number with negative exponent', () => {
        const r = tokenizeSource('1e-2');
        // Digit(1), Letter(e), Hyphen(-), Digit(2)
        const len = cssNumberLength(r.types, 0, r.tokenCount, r.source, r.ends, 0);
        expect(len).toBe(4);
    });

    test('number with positive exponent sign', () => {
        const r = tokenizeSource('1e+2');
        const len = cssNumberLength(r.types, 0, r.tokenCount, r.source, r.ends, 0);
        expect(len).toBe(4);
    });

    test('decimal with exponent', () => {
        const r = tokenizeSource('3.14e2');
        const len = cssNumberLength(r.types, 0, r.tokenCount, r.source, r.ends, 0);
        // Digit(3), Dot(.), Digit(14), Letter(e), Digit(2)
        expect(len).toBe(5);
    });

    test('negative decimal', () => {
        const r = tokenizeSource('-0.5');
        // Hyphen, Digit(0), Dot, Digit(5)
        const len = cssNumberLength(r.types, 0, r.tokenCount, r.source, r.ends, 0);
        expect(len).toBe(4);
    });

    test('returns 0 for letter', () => {
        const r = tokenizeSource('abc');
        expect(cssNumberLength(r.types, 0, r.tokenCount, r.source, r.ends, 0)).toBe(0);
    });

    test('returns 0 for just a dot', () => {
        const r = tokenizeSource('. ');
        expect(cssNumberLength(r.types, 0, r.tokenCount, r.source, r.ends, 0)).toBe(0);
    });

    test('returns 0 for sign only', () => {
        const r = tokenizeSource('+ ');
        expect(cssNumberLength(r.types, 0, r.tokenCount, r.source, r.ends, 0)).toBe(0);
    });

    test('respects offset', () => {
        const r = tokenizeSource('x42');
        // Letter(x), Digit(42)
        expect(cssNumberLength(r.types, 1, r.tokenCount, r.source, r.ends, 0)).toBe(1);
    });

    test('integer followed by non-digit text returns just the number', () => {
        const r = tokenizeSource('42px');
        // Digit(42), Letter(px)
        expect(cssNumberLength(r.types, 0, r.tokenCount, r.source, r.ends, 0)).toBe(1);
    });

    test('multi-letter token starting with e is not an exponent', () => {
        // 'em' is a 2-char Letter token, should not be treated as exponent
        const r = tokenizeSource('1em');
        // Digit(1), Letter(em) — 'em' is 2 chars, not a single 'e'
        expect(cssNumberLength(r.types, 0, r.tokenCount, r.source, r.ends, 0)).toBe(1);
    });

    test('exponent with no digit after is not consumed', () => {
        const r = tokenizeSource('1e ');
        // Digit(1), Letter(e), Whitespace
        // 'e' is a single letter but no digit follows → backtrack exponent
        expect(cssNumberLength(r.types, 0, r.tokenCount, r.source, r.ends, 0)).toBe(1);
    });
});
