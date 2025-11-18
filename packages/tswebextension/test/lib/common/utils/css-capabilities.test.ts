import { describe, it, expect } from 'vitest';

import { selectorContainsNativeAndExtCss } from '../../../../src/lib/common/utils/css-capabilities';

describe('CSS Capabilities', () => {
    describe('selectorContainsNativeAndExtCss', () => {
        it('should return true for selectors containing :has(), :is(), or :not()', () => {
            expect(selectorContainsNativeAndExtCss('.banner:has(.ad)')).toBe(true);
            expect(selectorContainsNativeAndExtCss('div:has(> p)')).toBe(true);
            expect(selectorContainsNativeAndExtCss('.target:is(div, p)')).toBe(true);
            expect(selectorContainsNativeAndExtCss('.target:not(.excluded)')).toBe(true);
            expect(selectorContainsNativeAndExtCss('.class1:has(.class2):not(.class3)')).toBe(true);
        });

        it('should return false for selectors containing :-abp-has() (always extended)', () => {
            // -abp-has is always extended CSS, not conditionally handled
            expect(selectorContainsNativeAndExtCss('.banner:-abp-has(.ad)')).toBe(false);
            expect(selectorContainsNativeAndExtCss('div:-abp-has(> p)')).toBe(false);
        });

        it('should return false for selectors without native-and-ext pseudo-classes', () => {
            expect(selectorContainsNativeAndExtCss('.banner')).toBe(false);
            expect(selectorContainsNativeAndExtCss('div > p')).toBe(false);
            expect(selectorContainsNativeAndExtCss('input:checked')).toBe(false);
            expect(selectorContainsNativeAndExtCss('.target:contains(text)')).toBe(false);
        });

        it('should correctly handle pseudo-classes in attribute values', () => {
            // CssTokenStream correctly recognizes that :has( inside attribute values
            // is NOT a pseudo-class, unlike the old regex approach
            expect(selectorContainsNativeAndExtCss('[data-test=":has("]')).toBe(false);
            expect(selectorContainsNativeAndExtCss('[data-test=":is("]')).toBe(false);
        });
    });
});
