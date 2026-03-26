import { CssTokenStream } from '@adguard/agtree';

import { logger } from './logger';

/**
 * Utility class for detecting CSS feature support in the browser.
 */
export class CssCapabilities {
    /**
     * Cache for CSS feature support detection results.
     */
    private static cache = new Map<string, boolean>();

    /**
     * Detects if the browser supports a specific CSS feature using `CSS.supports()`.
     *
     * @param feature CSS feature to test (e.g., "selector(:has(a))").
     *
     * @returns True if the feature is supported, false otherwise.
     */
    private static isCssFeatureSupported(feature: string): boolean {
        // Check cache first
        const cached = CssCapabilities.cache.get(feature);
        if (cached !== undefined) {
            return cached;
        }

        let result = false;

        // Check if CSS.supports() is available (it should be in all modern browsers)
        if (typeof CSS !== 'undefined' && typeof CSS.supports === 'function') {
            try {
                result = CSS.supports(feature);
            } catch (e) {
                // If CSS.supports() throws an error, the feature is not supported
                logger.debug(`[tsweb.CssCapabilities.isCssFeatureSupported]: CSS.supports() failed for feature: ${feature} due to`, e);
                result = false;
            }
        }

        // Cache the result
        CssCapabilities.cache.set(feature, result);

        return result;
    }

    /**
     * Checks if the browser natively supports pseudo-classes
     * that are supported natively now
     * but may be considered extended in older browsers:
     * `:has()`, `:is()`, and `:not()`.
     *
     * @returns True if all native-and-extended pseudo-classes are supported,
     * false otherwise.
     */
    public static isNativeHasPseudoClassSupported(): boolean {
        // For simplicity, we check :has() as a representative
        // :is() and :not() have been supported for longer than :has().
        // So if :has() is supported, we can safely assume :is() and :not() are too
        return CssCapabilities.isCssFeatureSupported('selector(:has(a))');
    }

    /**
     * Checks if a CSS selector contains any native pseudo-classes
     * that may be considered as extended for older browsers.
     * These are `:has()`, `:is()`, and `:not()`.
     *
     * Note: `:-abp-has()` is always extended and not considered native.
     *
     * @param selector CSS selector string to check.
     *
     * @returns True if the selector is potentially extended for older browsers,
     * false otherwise.
     */
    public static isPotentiallyExtendedCss(selector: string): boolean {
        return CssTokenStream.hasNativeCssPseudoClass(selector);
    }
}
