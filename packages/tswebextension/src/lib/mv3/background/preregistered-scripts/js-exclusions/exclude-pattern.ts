import { type PatternHost } from './types';

/**
 * Characters a match-pattern path can carry. Everything else (a wildcard
 * inside the path, a query, a regexp construct) cannot be expressed as an
 * `excludeMatches` entry.
 */
const MATCH_PATTERN_PATH = /^\/[\w~%./-]*$/;

/**
 * Builds the `excludeMatches` pattern for one exception of the host.
 *
 * @param patternHost Host part of the pattern.
 * @param hostname Hostname the registration is for.
 * @param caseSensitive Whether the rule carries `$match-case`.
 *
 * @returns Match pattern, or `undefined` when the pattern cannot be expressed
 * (a host-wide exception, a wildcard path, a query, a regexp).
 */
export const toExcludePattern = (
    patternHost: PatternHost,
    hostname: string,
    caseSensitive: boolean,
): string | undefined => {
    const path = patternHost.rest;
    if (!MATCH_PATTERN_PATH.test(path)) {
        return undefined;
    }

    // The engine keys a `||host` pattern by the host as written, and its
    // hostname table is case-sensitive, so `||YouTube.com/ads` matches no
    // real URL and the engine keeps JS on. The exclusion names the lowercased
    // hostname of the registration, so it would exclude a page the engine
    // allows — the scriptlets would be lost.
    if (patternHost.host !== patternHost.host.toLowerCase()) {
        return undefined;
    }

    // `$match-case` makes the engine compare the whole URL case-sensitively,
    // the scheme included, and the exclusion always names a lowercased scheme:
    // a differently spelled one would exclude a page the engine allows.
    if (caseSensitive && patternHost.rawScheme !== patternHost.rawScheme.toLowerCase()) {
        return undefined;
    }

    // The browser compares the path of a match pattern case-sensitively and
    // the engine does not unless the rule has `$match-case` (probed in a
    // browser: `/Ads` does not exclude `/ads`). An uppercase path would match
    // no realistic page, so it keeps the host dynamic; a lowercase path still
    // misses an uppercase spelling of the same page, which is the accepted gap
    // listed in the README.
    if (!caseSensitive && /[A-Z]/.test(path)) {
        return undefined;
    }

    // The engine matches the pattern as `host` followed by the path, and the
    // registration covers the host only: the exclusion is anchored to it. A
    // scheme-anchored exception keeps its scheme, so the other scheme — where
    // the engine does not disable JS — is not excluded.
    return `${patternHost.scheme}://${hostname}${path}*`;
};
