import { describe, expect, test } from 'vitest';

import {
    hasAllProducts,
    hasProduct,
    isUnknown,
    SYNTAX_ABP,
    SYNTAX_ADG,
    SYNTAX_ALL,
    SYNTAX_UBO,
    SYNTAX_UNKNOWN,
    type SyntaxFlags,
} from '../../src/utils/syntax-flags';

describe('isUnknown', () => {
    test('returns true for 0', () => {
        expect(isUnknown(SYNTAX_UNKNOWN)).toBe(true);
    });

    test('returns false for any bit set', () => {
        expect(isUnknown(SYNTAX_ADG)).toBe(false);
        expect(isUnknown(SYNTAX_ALL)).toBe(false);
    });
});

describe('hasAllProducts', () => {
    test('returns true when all bits set', () => {
        expect(hasAllProducts(SYNTAX_ALL)).toBe(true);
    });

    test('returns false for partial', () => {
        expect(hasAllProducts((SYNTAX_ADG | SYNTAX_UBO) as SyntaxFlags)).toBe(false);
        expect(hasAllProducts(SYNTAX_ADG)).toBe(false);
    });
});

describe('hasProduct', () => {
    test('checks individual bits', () => {
        expect(hasProduct(SYNTAX_ALL, SYNTAX_ADG)).toBe(true);
        expect(hasProduct(SYNTAX_ALL, SYNTAX_UBO)).toBe(true);
        expect(hasProduct(SYNTAX_ALL, SYNTAX_ABP)).toBe(true);
        expect(hasProduct((SYNTAX_ADG | SYNTAX_UBO) as SyntaxFlags, SYNTAX_ABP)).toBe(false);
        expect(hasProduct(SYNTAX_ADG, SYNTAX_UBO)).toBe(false);
    });
});
