/**
 * @file Names of Extended CSS pseudo-classes whose functional argument is
 * raw text rather than CSS selector syntax.
 */

/**
 * Checks whether the pseudo-class name at `source[start..end)` is an Extended
 * CSS pseudo-class with a raw-text argument.
 *
 * The argument of such a pseudo-class is not a CSS selector or a CSS-typed
 * value: `[` and `]` inside it are plain characters rather than attribute
 * brackets, quotes are plain characters rather than CSS string delimiters,
 * and modifier-like text inside it is plain text. Callers balance the
 * parentheses themselves and must not interpret the argument as CSS.
 *
 * The name is matched by length first, then compared in place, without
 * allocating a substring.
 *
 * @param source Source string.
 * @param start Start offset of the pseudo-class name.
 * @param end End offset of the pseudo-class name (exclusive).
 *
 * @returns `true` if the name is an Extended CSS pseudo-class with a raw
 * argument.
 */
export function isExtendedCssPseudoClass(source: string, start: number, end: number): boolean {
    switch (end - start) {
        case 5:
            return source.startsWith('xpath', start);
        case 8:
            return source.startsWith('contains', start) || source.startsWith('has-text', start);
        case 11:
            return source.startsWith('matches-css', start);
        case 12:
            return source.startsWith('matches-attr', start);
        case 13:
            return source.startsWith('-abp-contains', start);
        case 16:
            return source.startsWith('matches-property', start);
        case 17:
            return source.startsWith('matches-css-after', start);
        case 18:
            return source.startsWith('matches-css-before', start);
        default:
            return false;
    }
}
