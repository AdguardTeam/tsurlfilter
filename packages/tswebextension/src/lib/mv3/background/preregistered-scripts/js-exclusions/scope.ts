import { type NetworkRule, type Request } from '@adguard/tsurlfilter';

import { type PatternHost, Scope } from './types';

/**
 * Escapes a literal for a regular expression.
 *
 * @param text Literal text.
 *
 * @returns Escaped text.
 */
const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Checks whether a rule without a host part still matches the root page of the
 * hostname. Such an exception decides the very page the registration covers
 * and no exclusion can express it.
 *
 * @param rule Candidate rule.
 * @param rootRequests Root-page requests of the registration's hostname.
 *
 * @returns True when the rule matches a root page of the host.
 */
export const reachesRootPage = (rule: NetworkRule, rootRequests: readonly Request[]): boolean => (
    rootRequests.some((request) => rule.match(request))
);

/**
 * Checks whether a host pattern with wildcards matches the hostname. The
 * engine's `*` spans dots, so the comparison is a glob, not a label match.
 *
 * @param host Host part of the pattern.
 * @param hostname Hostname to check.
 *
 * @returns True when the pattern matches the hostname.
 */
const matchesWildcardHost = (host: string, hostname: string): boolean => {
    const source = host.split('*').map(escapeRegExp).join('.*');

    return new RegExp(`^${source}$`).test(hostname);
};

/**
 * Checks whether a wildcard host reaches the hostname directly or through the
 * subdomain prefix a `||` pattern allows: the engine compiles `||host` to
 * `^(http|https)://([a-z0-9-_.]+\.)?<glob>`, so `||youtu*.com` matches
 * `www.youtube.com` as well.
 *
 * @param host Host part of the pattern.
 * @param hostname Hostname to check.
 *
 * @returns True when the glob matches the hostname or one of its parents.
 */
const matchesWildcardHostOrSubdomain = (host: string, hostname: string): boolean => {
    if (matchesWildcardHost(host, hostname)) {
        return true;
    }

    let parent = hostname;

    while (parent.includes('.')) {
        parent = parent.slice(parent.indexOf('.') + 1);

        if (matchesWildcardHost(host, parent)) {
            return true;
        }
    }

    return false;
};

/**
 * Checks whether the text before the first `*` of a token matches the hostname
 * or, for a `||` anchor, one of its label-boundary parents.
 *
 * The engine expands `*` to `.*` and leaves the end of the pattern open, so the
 * token can run past the hostname into the path: `||youtube.com*ads` matches
 * `https://youtube.com/ads`, and the tail can be completed by any path. The
 * anchored text is therefore the whole reach condition.
 *
 * @param host Host token of the pattern.
 * @param hostname Hostname to check.
 * @param allowSubdomains Whether the pattern anchor accepts subdomains.
 *
 * @returns True when the token may run past the hostname.
 */
const matchesWildcardHostPrefix = (
    host: string,
    hostname: string,
    allowSubdomains: boolean,
): boolean => {
    const prefix = host.slice(0, host.indexOf('*'));

    // A token that starts with `*` is decided by the full-glob comparison.
    if (!prefix) {
        return false;
    }

    let candidate: string | undefined = hostname;

    while (candidate) {
        if (candidate.startsWith(prefix)) {
            return true;
        }

        candidate = allowSubdomains && candidate.includes('.')
            ? candidate.slice(candidate.indexOf('.') + 1)
            : undefined;
    }

    return false;
};

/**
 * Resolves how a pattern's host part relates to the registered hostname.
 *
 * @param patternHost Host part of the pattern.
 * @param hostname Hostname the registration is for.
 *
 * @returns Scope member of the pattern: `Scope.Host` when it is pinned to this
 * hostname, `Scope.Unknown` when the engine reaches the host but a
 * match-pattern anchor cannot express it, `Scope.Other` when the pattern
 * belongs to another site.
 */
export const resolveScope = (
    patternHost: PatternHost,
    hostname: string,
): Scope => {
    const host = patternHost.host.toLowerCase();

    if (!patternHost.anchored) {
        // A substring search cannot be pinned: `youtube.com/ads` also matches
        // `https://youtube.com/watch?u=youtube.com/ads`, so the reach of the
        // rule is wider than the URL prefix an exclusion could name. The
        // token counts as reaching the host when it occurs anywhere inside the
        // hostname — `tube.com` and the wildcard `you*.com` both match
        // `https://youtube.com/ads` in the engine.
        if (host.includes('*')) {
            // The token is matched anywhere in the URL, so it is a substring
            // glob, not a host-anchored one: `youtube.*` also occurs inside
            // `www.youtube.com`.
            const wildcard = new RegExp(host.split('*').map(escapeRegExp).join('.*'));
            if (wildcard.test(hostname)) {
                return Scope.Unknown;
            }

            // The `*` may consume the rest of the hostname and the path, so
            // the text before the first `*` is what has to occur in the host.
            const [prefix = ''] = host.split('*');

            return prefix !== '' && hostname.includes(prefix) ? Scope.Unknown : Scope.Other;
        }

        return hostname.includes(host) ? Scope.Unknown : Scope.Other;
    }

    if (hostname === host || (patternHost.allowSubdomains && hostname.endsWith(`.${host}`))) {
        return Scope.Host;
    }

    // A wildcard host (`||*.youtube.com`) reaches the hostname in the engine,
    // but no exclusion can be anchored to it. The engine's `*` spans dots, so
    // the comparison is a glob — and a `||` pattern may also reach the hostname
    // through its subdomain prefix (`||youtu*.com` on `www.youtube.com`).
    if (host.includes('*')) {
        const reaches = patternHost.allowSubdomains
            ? matchesWildcardHostOrSubdomain(host, hostname)
            : matchesWildcardHost(host, hostname);

        if (reaches) {
            return Scope.Unknown;
        }

        // The engine expands `*` to `.*` and leaves the end of the pattern
        // open, so a token can run past the hostname into the path:
        // `||youtube.com*ads` matches `https://youtube.com/ads`. The text
        // before the first `*` is what the engine anchors, so it decides the
        // reach of such a token.
        return matchesWildcardHostPrefix(host, hostname, patternHost.allowSubdomains)
            ? Scope.Unknown
            : Scope.Other;
    }

    // An unterminated host part is a prefix match: `||youtube` and `||youtube.`
    // both reach `www.youtube.com`, while their text does not name it.
    const terminated = /^[/^?#]/.test(patternHost.rest);

    return !terminated && (hostname.startsWith(host) || hostname.includes(`.${host}`))
        ? Scope.Unknown
        : Scope.Other;
};
