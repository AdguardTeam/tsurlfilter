import { describe, expect, test } from 'vitest';

import { cssHashLength } from '../../../src/css/tokenizer/css-token-mapping';

import { tokenizeSource } from './helpers/test-utils';

describe('cssHashLength', () => {
    test('#abc (simple ident after hash)', () => {
        const r = tokenizeSource('#abc');
        expect(cssHashLength(r.types, 0, r.tokenCount, r.source, r.ends, 0)).toBe(2);
    });

    test('#123 (digits after hash)', () => {
        const r = tokenizeSource('#123');
        expect(cssHashLength(r.types, 0, r.tokenCount, r.source, r.ends, 0)).toBe(2);
    });

    test('#a1b2 (mixed ident after hash)', () => {
        const r = tokenizeSource('#a1b2');
        const len = cssHashLength(r.types, 0, r.tokenCount, r.source, r.ends, 0);
        expect(len).toBeGreaterThanOrEqual(3);
    });

    test('#fff (hex color)', () => {
        const r = tokenizeSource('#fff');
        expect(cssHashLength(r.types, 0, r.tokenCount, r.source, r.ends, 0)).toBe(2);
    });

    test('#-abc (hyphen then letters)', () => {
        const r = tokenizeSource('#-abc');
        const len = cssHashLength(r.types, 0, r.tokenCount, r.source, r.ends, 0);
        expect(len).toBeGreaterThanOrEqual(2);
    });

    test('# followed by space returns 0', () => {
        const r = tokenizeSource('# ');
        expect(cssHashLength(r.types, 0, r.tokenCount, r.source, r.ends, 0)).toBe(0);
    });

    test('# at end returns 0', () => {
        const r = tokenizeSource('#');
        expect(cssHashLength(r.types, 0, r.tokenCount, r.source, r.ends, 0)).toBe(0);
    });

    test('returns 0 for non-hash', () => {
        const r = tokenizeSource('abc');
        expect(cssHashLength(r.types, 0, r.tokenCount, r.source, r.ends, 0)).toBe(0);
    });

    test('# with escape', () => {
        const r = tokenizeSource('#\\!x');
        const len = cssHashLength(r.types, 0, r.tokenCount, r.source, r.ends, 0);
        // Hash + Escaped(\!) + Letter(x)
        expect(len).toBeGreaterThanOrEqual(3);
    });

    test('hex escape with mixed hex/non-hex letter run does not over-consume', () => {
        // Source: #\abg<space>
        // Tokens: HashMark(#), Escaped(\a), Letter(bg), Whitespace( )
        // Escaped(\a) starts a hex escape. 'b' is hex but 'g' is not.
        // Since Letter('bg') cannot be split, consumeCssEscape must refuse to
        // consume it — returning 1 (Escaped only). The outer loop then picks up
        // Letter('bg') as a normal ident-part.
        // Correct result: 3 tokens (# + Escaped + Letter).
        // Bug would return 4, pulling Whitespace into the hash span.
        const r = tokenizeSource('#\\abg ');
        expect(cssHashLength(r.types, 0, r.tokenCount, r.source, r.ends, 0)).toBe(3);
    });
});
