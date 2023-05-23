/**
 * Known ExtendedCSS elements
 */

export const EXTCSS_PSEUDO_CLASSES = [
    // AdGuard
    // https://github.com/AdguardTeam/ExtendedCss
    'has',
    'if-not',
    'contains',
    'matches-css',
    'matches-attr',
    'matches-property',
    'xpath',
    'nth-ancestor',
    'upward',
    'remove',
    'is',

    // uBlock Origin
    // https://github.com/gorhill/uBlock/wiki/Static-filter-syntax#procedural-cosmetic-filters
    'has-text',
    'matches-css-before',
    'matches-css-after',
    'matches-path',
    'min-text-length',
    'watch-attr',

    // Adblock Plus
    // https://help.eyeo.com/adblockplus/how-to-write-filters#elemhide-emulation
    '-abp-has',
    '-abp-contains',
    '-abp-properties',
];

export const EXTCSS_ATTRIBUTES = [
    // AdGuard
    '-ext-has',
    '-ext-if-not',
    '-ext-contains',
    '-ext-matches-css',
    '-ext-matches-attr',
    '-ext-matches-property',
    '-ext-xpath',
    '-ext-nth-ancestor',
    '-ext-upward',
    '-ext-remove',
    '-ext-is',

    // uBlock Origin
    '-ext-has-text',
    '-ext-matches-css-before',
    '-ext-matches-css-after',
    '-ext-matches-path',
    '-ext-min-text-length',
    '-ext-watch-attr',

    // Adblock Plus
    '-ext-abp-has',
    '-ext-abp-contains',
    '-ext-abp-properties',
];
