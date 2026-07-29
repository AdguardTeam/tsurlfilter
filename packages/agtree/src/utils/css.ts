/**
 * @file CSS selector utilities.
 */

import { NATIVE_CSS_PSEUDO_CLASSES } from '../converter/data/css';

/**
 * Matches a native-and-extended pseudo-class used in its functional form
 * (`:has(`, `:is(`, `:not(`). Built from {@link NATIVE_CSS_PSEUDO_CLASSES} so it
 * stays in sync with the data. The name must directly follow `:` and be
 * followed by `(`.
 *
 * The regex intentionally avoids negative lookbehind for broad engine
 * compatibility. Instead, matches that are preceded by `=`, `"`, or `'`
 * (common false-positive case of a pseudo-class name inside an attribute
 * value, e.g. `[data-test=":has("]`) are filtered out after matching.
 */
const NATIVE_CSS_PSEUDO_CLASS_RE = new RegExp(
    `:(?:${[...NATIVE_CSS_PSEUDO_CLASSES]
        .map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .join('|')})\\(`,
    'gi',
);

/**
 * Checks whether a CSS selector contains any pseudo-class that is native in
 * modern browsers but may be treated as Extended CSS in older ones
 * (`:has()`, `:is()`, `:not()`).
 *
 * Dependency-free (regex-based) by design — it intentionally avoids
 * `@adguard/css-tokenizer`. This is a conservative heuristic: a rare false
 * positive only routes a rule through the Extended CSS engine, which still
 * renders it correctly.
 *
 * @param selector CSS selector string to inspect.
 *
 * @returns `true` if the selector uses a native-and-extended pseudo-class.
 */
export const hasNativeCssPseudoClass = (selector: string): boolean => {
    // `matchAll` needs a global regex (the module-level one is `gi`) and uses
    // its own internal iterator, so the shared regex's `lastIndex` is never
    // mutated — no per-call `new RegExp` clone required.
    for (const match of selector.matchAll(NATIVE_CSS_PSEUDO_CLASS_RE)) {
        // Filter out matches preceded by `=`, `"`, or `'` (attribute-value
        // false positives, e.g. `[data-test=":has("]`). This replaces the
        // negative lookbehind for broad JS engine compatibility.
        const charBefore = selector[match.index - 1];
        if (charBefore !== '=' && charBefore !== '"' && charBefore !== "'") {
            return true;
        }
    }

    return false;
};
