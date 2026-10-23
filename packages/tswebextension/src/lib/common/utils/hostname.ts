/**
 * @file Browser-free hostname helpers shared by the MV3 runtime and the
 * build-time tooling. Kept separate from `url.ts`, which imports
 * `webextension-polyfill` and therefore cannot be loaded in Node: the
 * preregistered-scripts build-contract entry point must stay importable
 * outside an extension context.
 */

/**
 * Hostname shape: dot-separated labels of letters, digits and inner
 * hyphens, without wildcards, schemes, ports or paths.
 */
const HOSTNAME_REGEX = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/;

/**
 * Checks whether a value is a plain hostname — what a content-script match
 * pattern can use. Accepts single-label hosts such as `localhost`.
 *
 * @param hostname Normalized hostname.
 *
 * @returns True if the value is a plain hostname.
 */
export function isPlainHostname(hostname: string): boolean {
    return hostname.length <= 253 && HOSTNAME_REGEX.test(hostname);
}

/**
 * Normalizes a domain string for comparison: trims whitespace, lower-cases
 * it, strips leading/trailing dots and canonicalizes non-ASCII hosts to
 * punycode — the form browsers report in `URL.hostname`. The `www.` prefix
 * is NOT stripped: content-script match patterns are exact-host, so apex
 * and `www.` are distinct registrations.
 *
 * @param domain Raw domain string.
 *
 * @returns Normalized domain string.
 */
export function normalizeDomain(domain: string): string {
    const normalized = domain.trim().toLowerCase().replace(/^\.+|\.+$/g, '');

    try {
        return new URL(`http://${normalized}`).hostname;
    } catch {
        // Not a parseable host.
        return normalized;
    }
}
