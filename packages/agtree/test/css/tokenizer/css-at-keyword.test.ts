import { describe, expect, test } from 'vitest';

import { cssAtKeywordLength } from '../../../src/css/tokenizer/css-token-mapping';

import { tokenizeSource } from './helpers/test-utils';

describe('cssAtKeywordLength', () => {
    test('@media', () => {
        const r = tokenizeSource('@media');
        expect(cssAtKeywordLength(r.types, 0, r.tokenCount, r.source, r.ends, 0)).toBe(2);
    });

    test('@font-face', () => {
        const r = tokenizeSource('@font-face');
        // AtSign, Letter(font), Hyphen, Letter(face)
        const len = cssAtKeywordLength(r.types, 0, r.tokenCount, r.source, r.ends, 0);
        expect(len).toBe(4);
    });

    test('@keyframes', () => {
        const r = tokenizeSource('@keyframes');
        expect(cssAtKeywordLength(r.types, 0, r.tokenCount, r.source, r.ends, 0)).toBe(2);
    });

    test('@ followed by non-ident returns 0', () => {
        const r = tokenizeSource('@ ');
        expect(cssAtKeywordLength(r.types, 0, r.tokenCount, r.source, r.ends, 0)).toBe(0);
    });

    test('@ at end returns 0', () => {
        const r = tokenizeSource('@');
        expect(cssAtKeywordLength(r.types, 0, r.tokenCount, r.source, r.ends, 0)).toBe(0);
    });

    test('returns 0 for non-at token', () => {
        const r = tokenizeSource('abc');
        expect(cssAtKeywordLength(r.types, 0, r.tokenCount, r.source, r.ends, 0)).toBe(0);
    });

    test('@ followed by digit returns 0', () => {
        const r = tokenizeSource('@123');
        expect(cssAtKeywordLength(r.types, 0, r.tokenCount, r.source, r.ends, 0)).toBe(0);
    });

    test('@-webkit-transform (vendor prefix)', () => {
        const r = tokenizeSource('@-webkit-transform');
        const len = cssAtKeywordLength(r.types, 0, r.tokenCount, r.source, r.ends, 0);
        expect(len).toBeGreaterThanOrEqual(5);
    });
});
