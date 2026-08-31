import { describe, expect, test } from 'vitest';

import { cssFunctionLength } from '../../../src/css/tokenizer/css-token-mapping';

import { tokenizeSource } from './helpers/test-utils';

describe('cssFunctionLength', () => {
    test('rgb(', () => {
        const r = tokenizeSource('rgb(');
        expect(cssFunctionLength(r.types, 0, r.tokenCount, r.source, r.ends, 0)).toBe(2);
    });

    test('calc(', () => {
        const r = tokenizeSource('calc(');
        expect(cssFunctionLength(r.types, 0, r.tokenCount, r.source, r.ends, 0)).toBe(2);
    });

    test('translateX(', () => {
        const r = tokenizeSource('translateX(');
        // Letter(translateX), OpenParen
        expect(cssFunctionLength(r.types, 0, r.tokenCount, r.source, r.ends, 0)).toBe(2);
    });

    test('ident without paren is not a function', () => {
        const r = tokenizeSource('abc ');
        expect(cssFunctionLength(r.types, 0, r.tokenCount, r.source, r.ends, 0)).toBe(0);
    });

    test('returns 0 for non-ident start', () => {
        const r = tokenizeSource('123(');
        expect(cssFunctionLength(r.types, 0, r.tokenCount, r.source, r.ends, 0)).toBe(0);
    });

    test('returns 0 for just a paren', () => {
        const r = tokenizeSource('(');
        expect(cssFunctionLength(r.types, 0, r.tokenCount, r.source, r.ends, 0)).toBe(0);
    });

    test('-webkit-calc(', () => {
        const r = tokenizeSource('-webkit-calc(');
        const len = cssFunctionLength(r.types, 0, r.tokenCount, r.source, r.ends, 0);
        // Hyphen, Letter(webkit), Hyphen, Letter(calc), OpenParen
        expect(len).toBe(5);
    });

    test('function at non-zero offset', () => {
        const r = tokenizeSource(' foo(');
        // Whitespace, Letter(foo), OpenParen
        expect(cssFunctionLength(r.types, 1, r.tokenCount, r.source, r.ends, 0)).toBe(2);
    });
});
