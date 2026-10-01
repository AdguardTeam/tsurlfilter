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
 * Modifier names of the source syntax (uBO/ABP) that the converter rewrites to
 * AG syntax names before a rule reaches the engine.
 *
 * They are still needed by name here: a `$badfilter` rule disables a rule only
 * when the rule text matches, so `$queryprune` and `$removeparam` are different
 * modifiers for it, even though the engine treats them alike.
 */
export const SOURCE_SYNTAX_ALIASES = Object.freeze({
    QUERYPRUNE: 'queryprune',
    REWRITE: 'rewrite',
} as const);

/**
 * A value-bearing modifier exactly as written in the rule text: its name and
 * its value.
 *
 * A pair list is used instead of a map because a `$badfilter` rule compares the
 * rule text, and a map would lose the order and collapse repeated modifiers.
 */
export type WrittenModifier = readonly [name: string, value: string];

/**
 * Shared empty written modifier list, so that a list is not allocated for every
 * rule that has no value-bearing modifiers.
 */
export const NO_WRITTEN_MODIFIERS: readonly WrittenModifier[] = Object.freeze([]);

/**
 * Modifiers whose written value must match for a `$badfilter` rule to negate
 * another rule. Values are compared as written, because the rule text must match.
 * `$domain` and `$denyallow` are compared separately, with domain normalization.
 */
export const VALUE_BEARING_OPTIONS: ReadonlySet<string> = new Set([
    NETWORK_RULE_OPTIONS.CSP,
    NETWORK_RULE_OPTIONS.REPLACE,
    NETWORK_RULE_OPTIONS.URLTRANSFORM,
    NETWORK_RULE_OPTIONS.COOKIE,
    NETWORK_RULE_OPTIONS.REDIRECT,
    NETWORK_RULE_OPTIONS.REDIRECTRULE,
    NETWORK_RULE_OPTIONS.REMOVEPARAM,
    NETWORK_RULE_OPTIONS.REMOVEHEADER,
    NETWORK_RULE_OPTIONS.PERMISSIONS,
    NETWORK_RULE_OPTIONS.CLIENT,
    NETWORK_RULE_OPTIONS.DNSREWRITE,
    NETWORK_RULE_OPTIONS.DNSTYPE,
    NETWORK_RULE_OPTIONS.CTAG,
    NETWORK_RULE_OPTIONS.HEADER,
    NETWORK_RULE_OPTIONS.METHOD,
    NETWORK_RULE_OPTIONS.TO,
    NETWORK_RULE_OPTIONS.STEALTH,
    NETWORK_RULE_OPTIONS.APP,
    NETWORK_RULE_OPTIONS.JSONPRUNE,
    NETWORK_RULE_OPTIONS.HLS,
    NETWORK_RULE_OPTIONS.REFERRERPOLICY,
    SOURCE_SYNTAX_ALIASES.QUERYPRUNE,
    SOURCE_SYNTAX_ALIASES.REWRITE,
]);

export const MASK_ALLOWLIST = '@@';

export const NOT_MARK = '~';

export const ESCAPE_CHARACTER = '\\';
