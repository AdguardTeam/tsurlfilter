import {
    describe,
    it,
    expect,
    beforeEach,
    vi,
} from 'vitest';

import { CssCapabilities } from '../../../../src/lib/common/utils/css-capabilities';

describe('CSS Capabilities', () => {
    beforeEach(() => {
        // Clear cache before each test
        // @ts-expect-error private property
        CssCapabilities.cache.clear();
    });

    describe('supportsNativeAndExtCssPseudoClasses', () => {
        it('should return true when CSS.supports returns true for :has()', () => {
            // Mock CSS.supports to return true
            global.CSS = {
                supports: vi.fn().mockReturnValue(true),
            } as any;

            expect(CssCapabilities.isNativeHasPseudoClassSupported()).toBe(true);
        });

        it('should return false when CSS.supports returns false for :has()', () => {
            // Mock CSS.supports to return false
            global.CSS = {
                supports: vi.fn().mockReturnValue(false),
            } as any;

            expect(CssCapabilities.isNativeHasPseudoClassSupported()).toBe(false);
        });

        it('should return false when CSS.supports is not available', () => {
            // Remove CSS global
            global.CSS = undefined as any;

            expect(CssCapabilities.isNativeHasPseudoClassSupported()).toBe(false);
        });

        it('should cache the result and not call CSS.supports multiple times', () => {
            const mockSupports = vi.fn().mockReturnValue(true);
            global.CSS = {
                supports: mockSupports,
            } as any;

            // Call multiple times
            CssCapabilities.isNativeHasPseudoClassSupported();
            CssCapabilities.isNativeHasPseudoClassSupported();
            CssCapabilities.isNativeHasPseudoClassSupported();

            // Should only be called once due to caching
            expect(mockSupports).toHaveBeenCalledTimes(1);
            expect(mockSupports).toHaveBeenCalledWith('selector(:has(a))');
        });

        it('should handle CSS.supports throwing an error', () => {
            global.CSS = {
                supports: vi.fn().mockImplementation(() => {
                    throw new Error('Not supported');
                }),
            } as any;

            expect(CssCapabilities.isNativeHasPseudoClassSupported()).toBe(false);
        });
    });

    describe('isPotentiallyExtendedCss', () => {
        it('should return true for selectors containing :has(), :is(), or :not()', () => {
            expect(CssCapabilities.isPotentiallyExtendedCss('.banner:has(.ad)')).toBe(true);
            expect(CssCapabilities.isPotentiallyExtendedCss('div:has(> p)')).toBe(true);
            expect(CssCapabilities.isPotentiallyExtendedCss('.target:is(div, p)')).toBe(true);
            expect(CssCapabilities.isPotentiallyExtendedCss('.target:not(.excluded)')).toBe(true);
            expect(CssCapabilities.isPotentiallyExtendedCss('.class1:has(.class2):not(.class3)')).toBe(true);
        });

        it('should return false for selectors containing :-abp-has() (always extended)', () => {
            // -abp-has is always extended CSS, not conditionally handled
            expect(CssCapabilities.isPotentiallyExtendedCss('.banner:-abp-has(.ad)')).toBe(false);
            expect(CssCapabilities.isPotentiallyExtendedCss('div:-abp-has(> p)')).toBe(false);
        });

        it('should return false for selectors without native-and-ext pseudo-classes', () => {
            expect(CssCapabilities.isPotentiallyExtendedCss('.banner')).toBe(false);
            expect(CssCapabilities.isPotentiallyExtendedCss('div > p')).toBe(false);
            expect(CssCapabilities.isPotentiallyExtendedCss('input:checked')).toBe(false);
            expect(CssCapabilities.isPotentiallyExtendedCss('.target:contains(text)')).toBe(false);
        });

        it('should correctly handle pseudo-classes in attribute values', () => {
            // CssTokenStream correctly recognizes that :has( inside attribute values
            // is NOT a pseudo-class, unlike the old regex approach
            expect(CssCapabilities.isPotentiallyExtendedCss('[data-test=":has("]')).toBe(false);
            expect(CssCapabilities.isPotentiallyExtendedCss('[data-test=":is("]')).toBe(false);
        });
    });
});
