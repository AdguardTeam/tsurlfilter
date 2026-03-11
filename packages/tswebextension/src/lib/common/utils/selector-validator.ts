import { logger } from './logger';

/**
 * CSS.supports() function name for selector validation.
 */
const SELECTOR_FUNCTION = 'selector';

/**
 * Validates a batch of CSS selectors using a two-tier approach:
 * - Fast path: validates all selectors joined as a selector list at once.
 * - Slow path: if the batch is invalid, validates each selector individually
 *   to identify and exclude the broken ones.
 *
 * Must be called in page/content script context — `CSS.supports()` is not
 * available in service workers or background pages.
 *
 * @param selectors Array of individual CSS selectors.
 *
 * @returns Object with `valid` and `invalid` selector arrays.
 */
export function validateSelectors(
    selectors: string[],
): { valid: string[]; invalid: string[] } {
    if (selectors.length === 0) {
        return { valid: [], invalid: [] };
    }

    /**
     * Fast path: validate all selectors joined as a selector list.
     * This is O(1) and covers the common case where all selectors are valid.
     *
     * NOTE: It is joined without comma because CSS.supports() fails to validate comma
     * split selectors. Validating without it creates a chained selector, but it
     * still produces valid result in terms of validation.
     */
    const joined = selectors.join(' ');
    let batchValid = false;

    try {
        batchValid = CSS.supports(`${SELECTOR_FUNCTION}(${joined})`);
    } catch (e) {
        logger.debug('[tsweb.selector-validator]: CSS.supports batch check threw error:', e);
        batchValid = false;
    }

    if (batchValid) {
        return { valid: selectors, invalid: [] };
    }

    // Slow path: at least one selector is invalid — find which ones.
    const valid: string[] = [];
    const invalid: string[] = [];

    for (const selector of selectors) {
        let isValid = false;

        try {
            isValid = CSS.supports(`${SELECTOR_FUNCTION}(${selector})`);
        } catch (e) {
            logger.debug(`[tsweb.selector-validator]: CSS.supports threw error for selector "${selector}":`, e);
            isValid = false;
        }

        // Fallback: CSS.supports can be unreliable in some browsers.
        // If it says invalid, double-check with querySelector.
        if (!isValid) {
            try {
                document.querySelector(selector);
                // If querySelector didn't throw, the selector is actually valid
                isValid = true;
                logger.debug(`[tsweb.selector-validator]: CSS.supports incorrectly rejected valid selector "${selector}", using querySelector fallback`);
            } catch (e) {
                // querySelector threw DOMException — selector is truly invalid
                isValid = false;
            }
        }

        if (isValid) {
            valid.push(selector);
        } else {
            invalid.push(selector);
            logger.warn(`[tsweb.selector-validator]: Invalid CSS selector skipped: "${selector}"`);
        }
    }

    return { valid, invalid };
}
