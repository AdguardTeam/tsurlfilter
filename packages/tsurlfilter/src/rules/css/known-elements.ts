/**
 * @file Known CSS / Extended CSS elements.
 */

/**
 * Supported Extended CSS pseudo-classes.
 *
 * These pseudo-classes are not supported by browsers natively, so we need Extended CSS library to support them.
 *
 * Pseudo-classes `:has()`, `:is()`, and `:not()` are not listed here,
 * because they may use native implementation.
 * They should be considered as extended CSS if:
 * - some other strictly extended CSS pseudo-classes are present in the selector, OR
 * - `#?#` separator is used explicitly.
 *
 * @see {@link https://github.com/AdguardTeam/ExtendedCss#extended-css-has}
 * @see {@link https://github.com/AdguardTeam/ExtendedCss#extended-css-is}
 * @see {@link https://github.com/AdguardTeam/ExtendedCss#extended-css-not}
 *
 * Please keep this list sorted alphabetically.
 */
export const SUPPORTED_EXT_CSS_PSEUDO_CLASSES: ReadonlySet<string> = new Set([
    '-abp-contains', // alias for 'contains'
    '-abp-has', // alias for 'has' - always extended (ABP-specific syntax)
    'contains',
    'has-text', // alias for 'contains'
    'if-not',
    'matches-attr',
    'matches-css',
    'matches-css-after', // deprecated, replaced by 'matches-css'
    'matches-css-before', // deprecated, replaced by 'matches-css'
    'matches-property',
    'nth-ancestor',
    'remove',
    'upward',
    'xpath',
]);

/**
 * Supported native CSS pseudo-classes.
 *
 * These pseudo-classes are supported by browsers natively, so we don't need Extended CSS library to support them.
 *
 * The problem with pseudo-classes is that any unknown pseudo-class makes browser ignore the whole CSS rule,
 * which contains a lot more selectors. So, if CSS selector contains a pseudo-class, we should try to validate it.
 * One more problem with pseudo-classes is that they are actively used in uBlock, hence it may mess AG styles.
 *
 * Please keep this list sorted alphabetically.
 */
export const SUPPORTED_CSS_PSEUDO_CLASSES: ReadonlySet<string> = new Set([
    'active', // https://developer.mozilla.org/en-US/docs/Web/CSS/:active
    'checked', // https://developer.mozilla.org/en-US/docs/Web/CSS/:checked
    'disabled', // https://developer.mozilla.org/en-US/docs/Web/CSS/:disabled
    'empty', // https://developer.mozilla.org/en-US/docs/Web/CSS/:empty
    'enabled', // https://developer.mozilla.org/en-US/docs/Web/CSS/:enabled
    'first-child', // https://developer.mozilla.org/en-US/docs/Web/CSS/:first-child
    'first-of-type', // https://developer.mozilla.org/en-US/docs/Web/CSS/:first-of-type
    'focus', // https://developer.mozilla.org/en-US/docs/Web/CSS/:focus
    'has', // https://developer.mozilla.org/en-US/docs/Web/CSS/:has
    'hover', // https://developer.mozilla.org/en-US/docs/Web/CSS/:hover
    'in-range', // https://developer.mozilla.org/en-US/docs/Web/CSS/:in-range
    'invalid', // https://developer.mozilla.org/en-US/docs/Web/CSS/:invalid
    'is', // https://developer.mozilla.org/en-US/docs/Web/CSS/:is
    'lang', // https://developer.mozilla.org/en-US/docs/Web/CSS/:lang
    'last-child', // https://developer.mozilla.org/en-US/docs/Web/CSS/:last-child
    'last-of-type', // https://developer.mozilla.org/en-US/docs/Web/CSS/:last-of-type
    'link', // https://developer.mozilla.org/en-US/docs/Web/CSS/:link
    'not', // https://developer.mozilla.org/en-US/docs/Web/CSS/:not
    'nth-child', // https://developer.mozilla.org/en-US/docs/Web/CSS/:nth-child
    'nth-last-child', // https://developer.mozilla.org/en-US/docs/Web/CSS/:nth-last-child
    'nth-last-of-type', // https://developer.mozilla.org/en-US/docs/Web/CSS/:nth-last-of-type
    'nth-of-type', // https://developer.mozilla.org/en-US/docs/Web/CSS/:nth-of-type
    'only-child', // https://developer.mozilla.org/en-US/docs/Web/CSS/:only-child
    'only-of-type', // https://developer.mozilla.org/en-US/docs/Web/CSS/:only-of-type
    'optional', // https://developer.mozilla.org/en-US/docs/Web/CSS/:optional
    'out-of-range', // https://developer.mozilla.org/en-US/docs/Web/CSS/:out-of-range
    'read-only', // https://developer.mozilla.org/en-US/docs/Web/CSS/:read-only
    'read-write', // https://developer.mozilla.org/en-US/docs/Web/CSS/:read-write
    'required', // https://developer.mozilla.org/en-US/docs/Web/CSS/:required
    'root', // https://developer.mozilla.org/en-US/docs/Web/CSS/:root
    'target', // https://developer.mozilla.org/en-US/docs/Web/CSS/:target
    'valid', // https://developer.mozilla.org/en-US/docs/Web/CSS/:valid
    'visited', // https://developer.mozilla.org/en-US/docs/Web/CSS/:visited
    'where', // https://developer.mozilla.org/en-US/docs/Web/CSS/:where
]);

/**
 * Every Extended CSS pseudo-class should start with this prefix.
 *
 * @see {@link https://github.com/AdguardTeam/ExtendedCss#-backward-compatible-syntax}
 */
export const EXT_CSS_ATTRIBUTE_SELECTOR_PREFIX = '-ext-';

/**
 * Supported legacy Extended CSS attribute selectors.
 *
 * Attribute selector way is deprecated and will be removed completely in the future,
 * we replaced it with Extended CSS pseudo-classes. For example, instead of
 * `[-ext-has="a[href]"]` you should use `:has(a[href])`.
 *
 * Please keep this list sorted alphabetically.
 */
export const SUPPORTED_EXT_CSS_ATTRIBUTE_SELECTORS: ReadonlySet<string> = new Set([
    `${EXT_CSS_ATTRIBUTE_SELECTOR_PREFIX}has`,
    `${EXT_CSS_ATTRIBUTE_SELECTOR_PREFIX}contains`,
    `${EXT_CSS_ATTRIBUTE_SELECTOR_PREFIX}has-text`,
    `${EXT_CSS_ATTRIBUTE_SELECTOR_PREFIX}matches-css`,
    `${EXT_CSS_ATTRIBUTE_SELECTOR_PREFIX}matches-css-before`,
    `${EXT_CSS_ATTRIBUTE_SELECTOR_PREFIX}matches-css-after`,
]);

/**
 * Known CSS functions that aren't allowed in CSS injection rules, because they
 * able to load external resources. Please, keep this list sorted.
 */
export const FORBIDDEN_CSS_FUNCTIONS: ReadonlySet<string> = new Set([
    // https://developer.mozilla.org/en-US/docs/Web/CSS/cross-fade
    '-webkit-cross-fade',
    'cross-fade',

    // https://developer.mozilla.org/en-US/docs/Web/CSS/image
    'image',

    // https://developer.mozilla.org/en-US/docs/Web/CSS/image-set
    '-webkit-image-set',
    'image-set',

    // https://developer.mozilla.org/en-US/docs/Web/CSS/url
    'url',
]);
