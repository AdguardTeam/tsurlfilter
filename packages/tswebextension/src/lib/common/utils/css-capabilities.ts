import { CssTokenStream } from '@adguard/agtree';

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
