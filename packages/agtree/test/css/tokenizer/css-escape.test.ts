import { describe, expect, test } from 'vitest';

import { isCssValidEscape } from '../../../src/css/tokenizer/css-token-mapping';

import { tokenizeSource } from './helpers/test-utils';

describe('isCssValidEscape', () => {
    test('returns true for backslash + non-newline char', () => {
        const r = tokenizeSource('\\a');
        // The first token should be Escaped
        expect(isCssValidEscape(r.types, 0, r.source, r.ends)).toBe(true);
    });

    test('returns true for backslash + digit', () => {
        const r = tokenizeSource('\\1');
        expect(isCssValidEscape(r.types, 0, r.source, r.ends)).toBe(true);
    });

    test('returns true for backslash + special char', () => {
        const r = tokenizeSource('\\!');
        expect(isCssValidEscape(r.types, 0, r.source, r.ends)).toBe(true);
    });

    test('returns false for backslash + newline (\\n)', () => {
        const r = tokenizeSource('\\\n');
        expect(isCssValidEscape(r.types, 0, r.source, r.ends)).toBe(false);
    });

    test('returns false for non-Escaped token', () => {
        const r = tokenizeSource('abc');
        expect(isCssValidEscape(r.types, 0, r.source, r.ends)).toBe(false);
    });

    test('returns true for backslash + space', () => {
        const r = tokenizeSource('\\ ');
        expect(isCssValidEscape(r.types, 0, r.source, r.ends)).toBe(true);
    });
});
