import { logger } from './logger';

/**
 * CSS.supports() function name for selector validation.
 */
const SELECTOR_FUNCTION = 'selector';

/**
 * Splits a CSS selector list at top-level commas, respecting quoted strings
 * and parenthesized/bracketed groups.
 *
 * "Top-level" means a comma that is NOT inside:
 * - Quotes (single or double).
 * - Parentheses (e.g., `:is(...)`, `:has(...)`).
 * - Square brackets (e.g., `[attr="..."]`).
 *
 * We use a hand-written parser instead of `@adguard/css-tokenizer` because
 * this code runs in content scripts where the tokenizer is not bundled.
 *
 * @param selectorList A single selector or comma-separated selector list.
 *
 * @returns Array of trimmed individual selector strings.
 */
export function splitSelectorList(selectorList: string): string[] {
    const parts: string[] = [];
    let current = 0;
    let parenDepth = 0;
    let bracketDepth = 0;
    let inDoubleQuote = false;
    let inSingleQuote = false;
    let lastSplit = 0;

    while (current < selectorList.length) {
        const ch = selectorList[current];

        if (ch === '\\') {
            // Skip escaped character
            current += 2;
            continue;
        }

        if (inDoubleQuote) {
            if (ch === '"') {
                inDoubleQuote = false;
            }
        } else if (inSingleQuote) {
            if (ch === "'") {
                inSingleQuote = false;
            }
        } else {
            switch (ch) {
                case '"':
                    inDoubleQuote = true;
                    break;
                case "'":
                    inSingleQuote = true;
                    break;
                case '(':
                    parenDepth += 1;
                    break;
                case ')':
                    parenDepth -= 1;
                    break;
                case '[':
                    bracketDepth += 1;
                    break;
                case ']':
                    bracketDepth -= 1;
                    break;
                case ',':
                    if (parenDepth === 0 && bracketDepth === 0) {
                        parts.push(selectorList.slice(lastSplit, current).trim());
                        lastSplit = current + 1;
                    }
                    break;
                default:
                    break;
            }
        }

        current += 1;
    }

    parts.push(selectorList.slice(lastSplit).trim());
    return parts;
}

/**
 * Tests whether a CSS selector (or space-joined group) is valid via CSS.supports().
 * Returns false on any exception or invalid syntax.
 *
 * @param selector Selector string to validate.
 *
 * @returns True if the browser considers the selector valid.
 */
function isSelectorSupported(selector: string): boolean {
    try {
        return CSS.supports(`${SELECTOR_FUNCTION}(${selector})`);
    } catch (e) {
        logger.debug(`[tsweb.selector-validator]: CSS.supports threw for "${selector}":`, e);
        return false;
    }
}

/**
 * Validates a single selector that may be a comma-separated list.
 * Splits at top-level commas and validates each part individually because
 * `CSS.supports('selector(A, B)')` fails due to comma ambiguity.
 *
 * @param selector A possibly comma-containing selector string.
 *
 * @returns True if the selector (or all parts of the list) is valid.
 */
function validateCommaSelector(selector: string): boolean {
    const parts = splitSelectorList(selector);

    if (parts.length > 1) {
        // True comma-separated list — ALL parts must be valid (matches browser behavior).
        return parts.every((part) => part.length > 0 && isSelectorSupported(part));
    }

    // Contains comma but not at top level (e.g., `[attr="a,b"]`) — validate as-is.
    return isSelectorSupported(selector);
}

/**
 * Validates a batch of CSS selectors using a two-tier approach:
 * - Fast path: validates all selectors joined as a selector list at once.
 * - Slow path: if the batch is invalid, validates each selector individually
 *   to identify and exclude the broken ones.
 *
 * For selectors that are comma-separated lists (e.g., `.a, .b`), each part
 * is validated individually because `CSS.supports('selector(A, B)')` fails
 * in browsers due to comma ambiguity.
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

    // Fast path: try batch validation first.
    // Joining selectors with spaces creates a valid compound selector argument
    // for CSS.supports('selector(A B C)'). Commas inside pseudo-classes like
    // `:is(.a, .b)` do NOT break this because browsers parse them as part of
    // the balanced parentheses within the `selector()` function argument.
    // Only TRUE top-level commas (e.g., `.a, .b`) cause CSS.supports to fail
    // because they are ambiguous with CSS.supports' own argument separators.
    // Since ~99% of real filter selectors have no top-level commas, this single
    // call handles the vast majority of page loads with zero overhead.
    if (isSelectorSupported(selectors.join(' '))) {
        return { valid: selectors, invalid: [] };
    }

    // Batch failed — either a selector is genuinely invalid, or a selector
    // contains a top-level comma which made CSS.supports reject the batch.
    // Strategy: partition selectors into "has comma" vs "no comma" groups.
    // If a comma-containing selector caused the failure, re-batching the
    // non-comma group will pass and we avoid O(n) individual checks for them.
    const noCommaSelectors: string[] = [];
    let hasCommaSelector = false;

    for (const selector of selectors) {
        if (selector.includes(',')) {
            hasCommaSelector = true;
        } else {
            noCommaSelectors.push(selector);
        }
    }

    // Re-batch the non-comma group. If this passes, all non-comma selectors
    // are valid and we only need individual checks for comma-containing ones.
    // We skip this when there are no comma selectors because in that case the
    // initial batch failure means at least one non-comma selector is invalid
    // and we must check them individually anyway.
    const allNoCommaValid = hasCommaSelector
        && noCommaSelectors.length > 0
        && isSelectorSupported(noCommaSelectors.join(' '));

    // Build result arrays preserving original order.
    const valid: string[] = [];
    const invalid: string[] = [];

    for (const selector of selectors) {
        let isValid: boolean;

        if (!selector.includes(',')) {
            isValid = allNoCommaValid || isSelectorSupported(selector);
        } else {
            isValid = validateCommaSelector(selector);
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
