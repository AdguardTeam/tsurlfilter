import { SimpleRegex } from '@adguard/tsurlfilter';

import { type PatternParse, PatternReach } from './types';

/**
 * Separator between the scheme and the authority of an absolute pattern.
 */
export const SCHEME_SEPARATOR = '://';

/**
 * Schemes a preregistered document can be loaded over: the registration uses
 * the `*` scheme wildcard, so an exclusion anchored to one of them still lies
 * inside its `matches`.
 */
const DOCUMENT_SCHEMES = new Set(['http', 'https']);

/**
 * Scheme wildcard of an exclusion that covers both document schemes.
 */
export const ANY_SCHEME = '*';

/**
 * Escapes a literal for a regular expression.
 *
 * @param text Literal text.
 *
 * @returns Escaped text.
 */
const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Narrows a `|`-anchored scheme to the document schemes it matches.
 *
 * The engine expands `*` in a scheme to `.*`, so `|*://`, `|http*://` and
 * `|h*ps://` all reach a document, while a literal scheme reaches one only when
 * it is http or https.
 *
 * @param rawScheme Scheme as written, possibly with `*`.
 *
 * @returns `*` when both document schemes match, the single scheme when only
 * one does, `undefined` when none can.
 */
const narrowDocumentScheme = (rawScheme: string): string | undefined => {
    const scheme = rawScheme.toLowerCase();
    const glob = new RegExp(`^${scheme.split('*').map(escapeRegExp).join('.*')}$`);
    const matched = [...DOCUMENT_SCHEMES].filter((candidate) => glob.test(candidate));

    if (matched.length === 0) {
        return undefined;
    }

    return matched.length === DOCUMENT_SCHEMES.size ? ANY_SCHEME : matched[0];
};

/**
 * Reads what a pattern can reach: `||host…`, `|scheme://host…`, `://host…` or a
 * bare `host/path` / `.host/path` name a host; a regexp, a bare path or a plain
 * substring name none.
 *
 * The scheme of a `|`-anchored pattern is decided here and nowhere else: a
 * document is loaded over http(s) only, so an anchor to another scheme, to a
 * protocol-relative prefix or to a path can never match one. A wildcard scheme
 * is narrowed to the document schemes it matches, because the engine expands
 * its `*` to `.*`.
 *
 * @param pattern Rule pattern.
 *
 * @returns What the pattern reaches (see {@link PatternParse}).
 */
export const parsePattern = (pattern: string): PatternParse => {
    let rest: string;
    let allowSubdomains = false;
    let scheme = ANY_SCHEME;
    let rawScheme = ANY_SCHEME;
    let anchored = true;

    if (pattern.startsWith(SimpleRegex.MASK_START_URL)) {
        rest = pattern.slice(SimpleRegex.MASK_START_URL.length);
        allowSubdomains = true;
    } else if (pattern.startsWith(SimpleRegex.MASK_PIPE)) {
        const pipeAnchored = pattern.slice(SimpleRegex.MASK_PIPE.length);

        // A document URL starts with its scheme, so neither a path nor a
        // protocol-relative prefix can start one.
        if (pipeAnchored.startsWith('/')) {
            return { kind: PatternReach.Unreachable };
        }

        const schemeIndex = pipeAnchored.indexOf(SCHEME_SEPARATOR);
        if (schemeIndex < 0) {
            // Plain text: `|http` prefixes every http(s) URL, so it reaches
            // any page while naming no host.
            return { kind: PatternReach.Hostless };
        }

        rawScheme = pipeAnchored.slice(0, schemeIndex);

        const narrowed = narrowDocumentScheme(rawScheme);
        if (narrowed === undefined) {
            return { kind: PatternReach.Unreachable };
        }
        scheme = narrowed;

        rest = pipeAnchored.slice(schemeIndex + SCHEME_SEPARATOR.length);
    } else if (pattern.startsWith(SCHEME_SEPARATOR) || /^[a-z][\w+.-]*:\/\//i.test(pattern)) {
        // `://host…` and `scheme://host…` are substring searches as well: the
        // engine tests the text against the whole URL, so it also matches the
        // same text inside the query of another page of the host.
        anchored = false;
        rawScheme = pattern.slice(0, pattern.indexOf(SCHEME_SEPARATOR));
        rest = pattern.slice(pattern.indexOf(SCHEME_SEPARATOR) + SCHEME_SEPARATOR.length);
    } else {
        // A bare `host/path` or `.host/path` is a substring search, not a host
        // anchor: the same text can sit inside a longer host or a query. The
        // leading dot is not special in the engine either, it is part of the
        // substring, so it still requires a label before the host part.
        anchored = false;
        // The leading dot is part of the substring, not an anchor: it is
        // stripped to read the host token.
        const bare = pattern.startsWith('.') ? pattern.slice(1) : pattern;
        const [firstToken = ''] = bare.split(/[/^?#]/);
        if (!/^[\w*%-]+(\.[\w*%-]+)+$/.test(firstToken)) {
            return { kind: PatternReach.Hostless };
        }
        rest = bare;
    }

    const host = rest.split(/[:/^?#]/)[0];
    if (!host) {
        return { kind: PatternReach.Hostless };
    }

    return {
        kind: PatternReach.Host,
        host: {
            host,
            allowSubdomains,
            rest: rest.slice(host.length),
            scheme,
            rawScheme,
            anchored,
        },
    };
};
