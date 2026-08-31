import { describe, expect, test } from 'vitest';

import { cssWhitespaceLength } from '../../../src/css/tokenizer/css-token-mapping';

import { tokenizeSource } from './helpers/test-utils';

describe('cssWhitespaceLength', () => {
    test('single space', () => {
        const r = tokenizeSource(' x');
        expect(cssWhitespaceLength(r.types, 0, r.tokenCount)).toBe(1);
    });

    test('multiple spaces', () => {
        const r = tokenizeSource('   x');
        // Spaces are collapsed into a single Whitespace token
        expect(cssWhitespaceLength(r.types, 0, r.tokenCount)).toBeGreaterThanOrEqual(1);
    });

    test('tab', () => {
        const r = tokenizeSource('\tx');
        expect(cssWhitespaceLength(r.types, 0, r.tokenCount)).toBeGreaterThanOrEqual(1);
    });

    test('newline', () => {
        const r = tokenizeSource('\nx');
        expect(cssWhitespaceLength(r.types, 0, r.tokenCount)).toBe(1);
    });

    test('mixed whitespace: space + newline', () => {
        const r = tokenizeSource(' \nx');
        expect(cssWhitespaceLength(r.types, 0, r.tokenCount)).toBe(2);
    });

    test('returns 0 for non-whitespace', () => {
        const r = tokenizeSource('abc');
        expect(cssWhitespaceLength(r.types, 0, r.tokenCount)).toBe(0);
    });

    test('returns 0 at end of tokens', () => {
        const r = tokenizeSource('x');
        expect(cssWhitespaceLength(r.types, r.tokenCount, r.tokenCount)).toBe(0);
    });

    test('whitespace after non-whitespace', () => {
        const r = tokenizeSource('x y');
        // tokens: Letter(x), Whitespace( ), Letter(y)
        expect(cssWhitespaceLength(r.types, 1, r.tokenCount)).toBe(1);
    });
});
