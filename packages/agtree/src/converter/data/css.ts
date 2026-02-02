/**
 * @file Known CSS elements and attributes.
 * TODO: Implement a compatibility table for Extended CSS
 */

/**
 * Legacy Extended CSS attribute prefix.
 *
 * @example
 * ```css
 * [-ext-<name>=...]
 * ```
 */
export const LEGACY_EXT_CSS_ATTRIBUTE_PREFIX = '-ext-';

/**
 * ABP Extended CSS prefix.
 *
 * @example
 * ```css
 * [-abp-<name>=...]
 * -abp-<name>(...)
 * ```
 */
export const ABP_EXT_CSS_PREFIX = '-abp';

/**
 * Known CSS pseudo-classes that are supported by all browsers natively,
 * but can also be applied as extended.
 */
export const NATIVE_CSS_PSEUDO_CLASSES: ReadonlySet<string> = new Set([
    /**
     * https://developer.mozilla.org/en-US/docs/Web/CSS/:has
     * https://github.com/AdguardTeam/ExtendedCss#extended-css-has
     */
    'has',

    /**
     * https://developer.mozilla.org/en-US/docs/Web/CSS/:is
     * https://github.com/AdguardTeam/ExtendedCss#extended-css-is
     */
    'is',

    /**
     * https://developer.mozilla.org/en-US/docs/Web/CSS/:not
     * https://github.com/AdguardTeam/ExtendedCss#extended-css-not
     */
    'not',
]);

/**
 * Known _strict_ Extended CSS pseudo-classes. Please, keep this list sorted.
 * Strict means that these pseudo-classes are not supported by any browser natively,
 * and they always require Extended CSS libraries to work.
 */
export const EXT_CSS_PSEUDO_CLASSES_STRICT: ReadonlySet<string> = new Set([
    // AdGuard
    // https://github.com/AdguardTeam/ExtendedCss
    'contains',
    'if-not',
    'matches-attr',
    'matches-css',
    'matches-property',
    'nth-ancestor',
    'remove',
    'upward',
    'xpath',

    // uBlock Origin
    // https://github.com/gorhill/uBlock/wiki/Static-filter-syntax#procedural-cosmetic-filters
    'has-text',
    'matches-css-after',
    'matches-css-before',
    'matches-path',
    'min-text-length',
    'watch-attr',

    // Adblock Plus
    // https://help.eyeo.com/adblockplus/how-to-write-filters#elemhide-emulation
    '-abp-contains',
    '-abp-has',
    '-abp-properties',
]);

/**
 * _ALL_ known Extended CSS pseudo-classes. Please, keep this list sorted.
 * It includes strict pseudo-classes and additional pseudo-classes that may be
 * supported by some browsers natively.
 */
export const EXT_CSS_PSEUDO_CLASSES: ReadonlySet<string> = new Set([
    ...EXT_CSS_PSEUDO_CLASSES_STRICT,
    ...NATIVE_CSS_PSEUDO_CLASSES,
]);

/**
 * Known legacy Extended CSS attributes. These attributes are deprecated and
 * should be replaced with the corresponding pseudo-classes. In a long term,
 * these attributes will be COMPLETELY removed from the Extended CSS syntax.
 *
 * Please, keep this list sorted.
 */
export const EXT_CSS_LEGACY_ATTRIBUTES: ReadonlySet<string> = new Set([
    // AdGuard
    '-ext-contains',
    '-ext-has',
    '-ext-if-not',
    '-ext-is',
    '-ext-matches-attr',
    '-ext-matches-css',
    '-ext-matches-property',
    '-ext-nth-ancestor',
    '-ext-remove',
    '-ext-upward',
    '-ext-xpath',

    // uBlock Origin
    '-ext-has-text',
    '-ext-matches-css-after',
    '-ext-matches-css-before',
    '-ext-matches-path',
    '-ext-min-text-length',
    '-ext-watch-attr',

    // Adblock Plus
    '-ext-abp-contains',
    '-ext-abp-has',
    '-ext-abp-properties',
]);

/**
 * Known extended CSS property that is used to remove elements.
 *
 * @see {@link https://github.com/AdguardTeam/ExtendedCss#remove-pseudos}
 */
export const REMOVE_PROPERTY = 'remove';

/**
 * Known extended CSS value for {@link REMOVE_PROPERTY} property to remove elements.
 *
 * @see {@link https://github.com/AdguardTeam/ExtendedCss#remove-pseudos}
 */
export const REMOVE_VALUE = 'true';
