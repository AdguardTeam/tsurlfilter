import { describe, expect, test } from 'vitest';

import { regionEqualsCI } from '../../src/parser/context';

describe('regionEqualsCI', () => {
    test('exact match lowercase', () => {
        expect(regionEqualsCI('media', 0, 5, 'media')).toBe(true);
    });

    test('match uppercase', () => {
        expect(regionEqualsCI('MEDIA', 0, 5, 'media')).toBe(true);
    });

    test('match mixed case', () => {
        expect(regionEqualsCI('Media', 0, 5, 'media')).toBe(true);
        expect(regionEqualsCI('mEdIa', 0, 5, 'media')).toBe(true);
    });

    test('length mismatch returns false', () => {
        expect(regionEqualsCI('med', 0, 3, 'media')).toBe(false);
        expect(regionEqualsCI('mediaX', 0, 6, 'media')).toBe(false);
    });

    test('content mismatch returns false', () => {
        expect(regionEqualsCI('medic', 0, 5, 'media')).toBe(false);
    });

    test('empty strings', () => {
        expect(regionEqualsCI('', 0, 0, '')).toBe(true);
        expect(regionEqualsCI('a', 0, 0, '')).toBe(true);
        expect(regionEqualsCI('', 0, 0, 'a')).toBe(false);
    });

    test('non-ASCII not folded', () => {
        // é (U+00E9) should not match e
        expect(regionEqualsCI('médía', 0, 5, 'media')).toBe(false);
    });

    test('substring region', () => {
        expect(regionEqualsCI('xxMEDIAyy', 2, 7, 'media')).toBe(true);
        expect(regionEqualsCI('xxMEDICyy', 2, 7, 'media')).toBe(false);
    });

    test('target must be lowercase for correct results', () => {
        // regionEqualsCI folds source to lowercase, so target should be lowercase
        expect(regionEqualsCI('MEDIA', 0, 5, 'MEDIA')).toBe(false);
    });
});
