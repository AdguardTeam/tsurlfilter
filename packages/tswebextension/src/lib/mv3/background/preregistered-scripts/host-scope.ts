import { SimpleRegex } from '@adguard/tsurlfilter';

/**
 * Checks whether a pattern host part covers the hostname: at a label
 * boundary always, and for host parts without a terminator also as a prefix,
 * because such a pattern may be followed by anything in the URL.
 *
 * @param hostPart Host part of the pattern.
 * @param hostname Hostname to check.
 * @param terminated Whether the host part ends with `/`, `^`, `?` or `#`.
 * @param allowSubdomains Whether the pattern anchor accepts subdomains (a
 * `||` anchor does, a scheme anchor does not: `|https://youtube.com/` never
 * matches `https://www.youtube.com/`).
 *
 * @returns True when the host part can cover the hostname.
 */
const isHostPartOfHost = (
    hostPart: string,
    hostname: string,
    terminated: boolean,
    allowSubdomains: boolean,
): boolean => {
    const host = hostname.toLowerCase();
    const part = hostPart.toLowerCase();

    if (host === part) {
        return true;
    }

    if (allowSubdomains && host.endsWith(`.${part}`)) {
        return true;
    }

    // `||youtube` matches `https://youtube.com/`, `||youtube.com` matches
    // `https://youtube.com.evil.com/`.
    return !terminated
        && (host.startsWith(part) || (allowSubdomains && host.includes(`.${part}`)));
};

/**
 * Checks whether the pattern can match some URL of the hostname. Only `||`-
 * and `|`-anchored patterns tie a rule to a host; everything else (regex
 * rules, `://host/...` fragments, plain text) is an unanchored match that
 * can occur inside a URL of any host.
 *
 * Shared by the build-time scanner, which bakes the gate entries, and the
 * runtime, which checks whether a rule from a runtime-only list (user rules,
 * custom filters) can reach a preregistered host.
 *
 * @param pattern Rule pattern.
 * @param hostname Hostname to check.
 *
 * @returns True when the pattern can match a URL of the hostname.
 */
export const matchesHostScope = (pattern: string, hostname: string): boolean => {
    let rest: string;
    let allowSubdomains: boolean;

    if (pattern.startsWith(SimpleRegex.MASK_START_URL)) {
        rest = pattern.slice(SimpleRegex.MASK_START_URL.length);
        allowSubdomains = true;
    } else if (pattern.startsWith('|')) {
        rest = pattern.slice(1);
        const schemeIndex = rest.indexOf('://');
        if (schemeIndex < 0) {
            return true;
        }
        rest = rest.slice(schemeIndex + 3);
        allowSubdomains = false;
    } else {
        return true;
    }

    const terminated = /[/^?#]/.test(rest);
    // A port is part of the pattern's authority, not of the hostname: the
    // engine matches the raw pattern, and the request hostname never has one.
    const hostPart = rest.split(/[:/^?#]/)[0];

    // An empty host part can span into the path, so it may match any host.
    if (!hostPart) {
        return true;
    }

    if (hostPart.includes('*')) {
        // The engine's `.*` matches across the authority boundary (it runs
        // against the whole URL), so only the literal prefix before the first
        // `*` is a sound host-scope signal. Over-inclusion is harmless: the
        // baked condition is the engine's own regex.
        const literalPrefix = hostPart.slice(0, hostPart.indexOf('*'));
        return !literalPrefix || isHostPartOfHost(literalPrefix, hostname, false, allowSubdomains);
    }

    return isHostPartOfHost(hostPart, hostname, terminated, allowSubdomains);
};
