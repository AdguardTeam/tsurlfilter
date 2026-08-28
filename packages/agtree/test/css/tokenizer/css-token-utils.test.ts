import { describe, expect, test } from 'vitest';

import {
    consumeCssIdentRun,
    isCssIdentPart,
    isCssIdentRun,
    isCssIdentStart,
    isCssWhitespace,
} from '../../../src/css/tokenizer/css-token-utils';
import { TokenType } from '../../../src/tokenizer/token-types';

describe('isCssIdentStart', () => {
    test('returns true for Letter and Underscore', () => {
        expect(isCssIdentStart(TokenType.Letter)).toBe(true);
        expect(isCssIdentStart(TokenType.Underscore)).toBe(true);
    });

    test('returns false for non-ident-start types', () => {
        expect(isCssIdentStart(TokenType.Hyphen)).toBe(false);
        expect(isCssIdentStart(TokenType.Digit)).toBe(false);
        expect(isCssIdentStart(TokenType.NonAscii)).toBe(false);
        expect(isCssIdentStart(TokenType.Escaped)).toBe(false);
        expect(isCssIdentStart(TokenType.Whitespace)).toBe(false);
        expect(isCssIdentStart(TokenType.Dot)).toBe(false);
        expect(isCssIdentStart(TokenType.HashMark)).toBe(false);
    });
});

describe('isCssIdentPart', () => {
    test('returns true for all ident-code-point types (0–4)', () => {
        expect(isCssIdentPart(TokenType.Letter)).toBe(true);
        expect(isCssIdentPart(TokenType.Hyphen)).toBe(true);
        expect(isCssIdentPart(TokenType.Digit)).toBe(true);
        expect(isCssIdentPart(TokenType.Underscore)).toBe(true);
        expect(isCssIdentPart(TokenType.NonAscii)).toBe(true);
    });

    test('returns false for non-ident types', () => {
        expect(isCssIdentPart(TokenType.Eof)).toBe(false);
        expect(isCssIdentPart(TokenType.Whitespace)).toBe(false);
        expect(isCssIdentPart(TokenType.Escaped)).toBe(false);
        expect(isCssIdentPart(TokenType.Symbol)).toBe(false);
        expect(isCssIdentPart(TokenType.Dot)).toBe(false);
        expect(isCssIdentPart(TokenType.Colon)).toBe(false);
    });
});

describe('isCssIdentRun', () => {
    test('returns true for ident-part and Escaped', () => {
        expect(isCssIdentRun(TokenType.Letter)).toBe(true);
        expect(isCssIdentRun(TokenType.Hyphen)).toBe(true);
        expect(isCssIdentRun(TokenType.Digit)).toBe(true);
        expect(isCssIdentRun(TokenType.Underscore)).toBe(true);
        expect(isCssIdentRun(TokenType.NonAscii)).toBe(true);
        expect(isCssIdentRun(TokenType.Escaped)).toBe(true);
    });

    test('returns false for non-ident-run types', () => {
        expect(isCssIdentRun(TokenType.Eof)).toBe(false);
        expect(isCssIdentRun(TokenType.Whitespace)).toBe(false);
        expect(isCssIdentRun(TokenType.Symbol)).toBe(false);
        expect(isCssIdentRun(TokenType.Dot)).toBe(false);
        expect(isCssIdentRun(TokenType.Colon)).toBe(false);
    });
});

describe('consumeCssIdentRun', () => {
    // Helper to build a Uint8Array from token types
    const types = (...values: number[]): Uint8Array => new Uint8Array(values);

    test('consumes a single Letter token', () => {
        const t = types(TokenType.Letter, TokenType.Dot);
        expect(consumeCssIdentRun(t, 0, t.length)).toBe(1);
    });

    test('consumes Letter + Hyphen + Letter (hyphenated ident)', () => {
        const t = types(TokenType.Letter, TokenType.Hyphen, TokenType.Letter, TokenType.Whitespace);
        expect(consumeCssIdentRun(t, 0, t.length)).toBe(3);
    });

    test('consumes Letter + Digit', () => {
        const t = types(TokenType.Letter, TokenType.Digit, TokenType.Eof);
        expect(consumeCssIdentRun(t, 0, t.length)).toBe(2);
    });

    test('consumes Underscore + Letter', () => {
        const t = types(TokenType.Underscore, TokenType.Letter, TokenType.Colon);
        expect(consumeCssIdentRun(t, 0, t.length)).toBe(2);
    });

    test('consumes Letter + NonAscii', () => {
        const t = types(TokenType.Letter, TokenType.NonAscii, TokenType.Eof);
        expect(consumeCssIdentRun(t, 0, t.length)).toBe(2);
    });

    test('consumes Letter + Escaped + Letter (escaped ident)', () => {
        const t = types(TokenType.Letter, TokenType.Escaped, TokenType.Letter, TokenType.Dot);
        expect(consumeCssIdentRun(t, 0, t.length)).toBe(3);
    });

    test('returns start index when no ident token at start', () => {
        const t = types(TokenType.Dot, TokenType.Letter);
        expect(consumeCssIdentRun(t, 0, t.length)).toBe(0);
    });

    test('respects start offset', () => {
        const t = types(TokenType.Dot, TokenType.Letter, TokenType.Hyphen, TokenType.Letter, TokenType.Eof);
        expect(consumeCssIdentRun(t, 1, t.length)).toBe(4);
    });

    test('stops at tokenCount boundary', () => {
        const t = types(TokenType.Letter, TokenType.Letter);
        expect(consumeCssIdentRun(t, 0, 1)).toBe(1);
    });

    test('handles empty range', () => {
        const t = types(TokenType.Letter);
        expect(consumeCssIdentRun(t, 0, 0)).toBe(0);
    });

    test('stops at Whitespace inside ident', () => {
        // Simulates hex escape trailing whitespace: \61 bc
        const t = types(
            TokenType.Escaped,
            TokenType.Digit,
            TokenType.Whitespace,
            TokenType.Letter,
            TokenType.Eof,
        );
        expect(consumeCssIdentRun(t, 0, t.length)).toBe(2);
    });
});

describe('isCssWhitespace', () => {
    test('returns true for Whitespace and LineBreak', () => {
        expect(isCssWhitespace(TokenType.Whitespace)).toBe(true);
        expect(isCssWhitespace(TokenType.LineBreak)).toBe(true);
    });

    test('returns false for non-whitespace types', () => {
        expect(isCssWhitespace(TokenType.Letter)).toBe(false);
        expect(isCssWhitespace(TokenType.Digit)).toBe(false);
        expect(isCssWhitespace(TokenType.Eof)).toBe(false);
        expect(isCssWhitespace(TokenType.Symbol)).toBe(false);
        expect(isCssWhitespace(TokenType.Escaped)).toBe(false);
        expect(isCssWhitespace(TokenType.Colon)).toBe(false);
    });
});
