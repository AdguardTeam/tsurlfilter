/**
 * @file Known CSS elements and attributes.
 * TODO: Implement a compatibility table for Extended CSS
 */

export const LEGACY_EXT_CSS_ATTRIBUTE_PREFIX = '-ext-';

/**
 * Known Extended CSS pseudo-classes. Please, keep this list sorted.
 */
export const EXT_CSS_PSEUDO_CLASSES = new Set([
    // AdGuard
    // https://github.com/AdguardTeam/ExtendedCss
    'contains',
    'has',
    'if-not',
    'is',
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
 * Known legacy Extended CSS attributes. These attributes are deprecated and
 * should be replaced with the corresponding pseudo-classes. In a long term,
 * these attributes will be COMPLETELY removed from the Extended CSS syntax.
 *
 * Please, keep this list sorted.
 */
export const EXT_CSS_LEGACY_ATTRIBUTES = new Set([
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
 * Known CSS functions that aren't allowed in CSS injection rules, because they
 * able to load external resources. Please, keep this list sorted.
 */
export const FORBIDDEN_CSS_FUNCTIONS = new Set([
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
