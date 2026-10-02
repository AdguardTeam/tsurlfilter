export const NETWORK_RULE_OPTIONS = {
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
    TO: 'to',
    PERMISSIONS: 'permissions',
    URLTRANSFORM: 'urltransform',
    ALL: 'all',
};

export const OPTIONS_DELIMITER = '$';

/**
 * Modifiers left out of the written-modifiers comparison key of a `$badfilter`
 * rule: `$badfilter` is the marker of the rule being compared, and `$domain` /
 * `$denyallow` are compared separately, with domain normalization.
 */
export const EXCLUDED_FROM_WRITTEN_KEY: ReadonlySet<string> = new Set([
    NETWORK_RULE_OPTIONS.BADFILTER,
    NETWORK_RULE_OPTIONS.DOMAIN,
    NETWORK_RULE_OPTIONS.DENYALLOW,
]);

/**
 * Separator of the written-modifiers comparison key. A rule is a single line, so
 * a modifier name or value cannot contain a line break.
 */
export const WRITTEN_MODIFIER_SEPARATOR = '\n';

export const MASK_ALLOWLIST = '@@';

export const NOT_MARK = '~';

export const ESCAPE_CHARACTER = '\\';
