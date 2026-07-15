/**
 * @file Canonical modifier name constants for network filtering rules.
 */

/**
 * Canonical modifier names for network filtering rules.
 *
 * @see {@link https://adguard.com/kb/general/ad-filtering/create-own-filters/#basic-rule-modifiers}
 */
export const OPTION_NAMES = Object.freeze({
    THIRD_PARTY: 'third-party',
    FIRST_PARTY: 'first-party',
    MATCH_CASE: 'match-case',
    IMPORTANT: 'important',
    DOMAIN: 'domain',
    DENYALLOW: 'denyallow',
    ELEMHIDE: 'elemhide',
    GENERICHIDE: 'generichide',
    SPECIFICHIDE: 'specifichide',
    GENERICBLOCK: 'genericblock',
    JSINJECT: 'jsinject',
    URLBLOCK: 'urlblock',
    CONTENT: 'content',
    DOCUMENT: 'document',
    DOC: 'doc',
    STEALTH: 'stealth',
    POPUP: 'popup',
    EMPTY: 'empty',
    MP4: 'mp4',
    SCRIPT: 'script',
    STYLESHEET: 'stylesheet',
    SUBDOCUMENT: 'subdocument',
    OBJECT: 'object',
    IMAGE: 'image',
    XMLHTTPREQUEST: 'xmlhttprequest',
    MEDIA: 'media',
    FONT: 'font',
    WEBSOCKET: 'websocket',
    OTHER: 'other',
    PING: 'ping',
    BADFILTER: 'badfilter',
    CSP: 'csp',
    REPLACE: 'replace',
    COOKIE: 'cookie',
    REDIRECT: 'redirect',
    REDIRECTRULE: 'redirect-rule',
    REMOVEPARAM: 'removeparam',
    REMOVEHEADER: 'removeheader',
    JSONPRUNE: 'jsonprune',
    HLS: 'hls',
    REFERRERPOLICY: 'referrerpolicy',
    APP: 'app',
    NETWORK: 'network',
    EXTENSION: 'extension',
    NOOP: '_',
    CLIENT: 'client',
    DNSREWRITE: 'dnsrewrite',
    DNSTYPE: 'dnstype',
    CTAG: 'ctag',
    HEADER: 'header',
    METHOD: 'method',
    URLTRANSFORM: 'urltransform',
    TO: 'to',
    PERMISSIONS: 'permissions',
    ALL: 'all',
} as const);

/**
 * Type of a single option name value.
 */
export type OptionName =
    (typeof OPTION_NAMES)[keyof typeof OPTION_NAMES];
