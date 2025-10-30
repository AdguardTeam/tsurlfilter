import { CssTokenStream } from '@adguard/agtree';

/**
 * Cache for CSS feature support detection results.
 */
const cssCapabilitiesCache = new Map<string, boolean>();

/**
 * Detects if the browser supports a specific CSS feature using CSS.supports().
 *
 * @param feature CSS feature to test (e.g., "selector(:has(a))").
 *
 * @returns True if the feature is supported, false otherwise.
 */
const supportsCssFeature = (feature: string): boolean => {
    // Check cache first
    const cached = cssCapabilitiesCache.get(feature);
    if (cached !== undefined) {
        return cached;
    }

    let result = false;

    // Check if CSS.supports is available (it should be in all modern browsers)
    if (typeof CSS !== 'undefined' && typeof CSS.supports === 'function') {
        try {
            result = CSS.supports(feature);
        } catch (e) {
            // If CSS.supports throws an error, the feature is not supported
            result = false;
        }
    }

    // Cache the result
    cssCapabilitiesCache.set(feature, result);

    return result;
};

/**
 * Checks if the browser natively supports pseudo-classes
 * that can be both native and extended.
 * These include :has(), :is(), and :not().
 *
 * @returns True if all native-and-extended pseudo-classes are supported,
 * false otherwise.
 */
export const supportsNativeAndExtCssPseudoClasses = (): boolean => {
    // For simplicity, we check :has() as a representative
    // :is() and :not() have been supported for longer than :has()
    // So if :has() is supported, we can safely assume :is() and :not() are too
    return supportsCssFeature('selector(:has(a))');
};

/**
 * Checks if a CSS selector contains any native-and-extended pseudo-classes.
 * These are :has(), :is(), and :not() (but NOT :-abp-has() which is always extended).
 *
 * @param selector CSS selector string to check.
 *
 * @returns True if the selector contains any native-and-extended pseudo-classes,
 * false otherwise.
 */
export const selectorContainsNativeAndExtCss = (selector: string): boolean => {
    try {
        const stream = new CssTokenStream(selector);
        return stream.hasAnySelectorNativeAndExtCssNode();
    } catch {
        return false;
    }
};

/**
 * Clears the CSS capabilities cache.
 * Useful for testing purposes.
 */
export const clearCssCapabilitiesCache = (): void => {
    cssCapabilitiesCache.clear();
};
