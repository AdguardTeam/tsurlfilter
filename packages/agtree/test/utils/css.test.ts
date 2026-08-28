import { describe, expect, it } from 'vitest';

import { hasNativeCssPseudoClass } from '../../src/utils/css';

describe('hasNativeCssPseudoClass', () => {
    it('detects :has()', () => {
        expect(hasNativeCssPseudoClass('div:has(> a)')).toBe(true);
    });

    it('detects :is() and :not()', () => {
        expect(hasNativeCssPseudoClass(':is(.a, .b)')).toBe(true);
        expect(hasNativeCssPseudoClass('a:not(.x)')).toBe(true);
    });

    it('returns false for a plain selector', () => {
        expect(hasNativeCssPseudoClass('div.banner > a')).toBe(false);
    });

    it('does not match the strictly-extended :-abp-has() form', () => {
        expect(hasNativeCssPseudoClass('div:-abp-has(> a)')).toBe(false);
    });

    it('ignores a pseudo-class name inside an attribute value', () => {
        // The `:has(` here is part of an attribute value string, not a real
        // functional pseudo-class, so the attribute-value guard must drop it.
        expect(hasNativeCssPseudoClass('[data-test=":has("]')).toBe(false);
        expect(hasNativeCssPseudoClass("[data-test=':is(']")).toBe(false);
    });

    it('detects a real pseudo-class alongside an attribute value', () => {
        // First `:has(` is inside the attribute value (ignored), the trailing
        // `:has(> a)` is a real pseudo-class and must be detected.
        expect(hasNativeCssPseudoClass('[data-test=":has("]:has(> a)')).toBe(true);
        expect(hasNativeCssPseudoClass('a[title="x"]:not(.y)')).toBe(true);
    });

    it('does not throw on malformed input', () => {
        expect(() => hasNativeCssPseudoClass('div:has(')).not.toThrow();
    });
});
