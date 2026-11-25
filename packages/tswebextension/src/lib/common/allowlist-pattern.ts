import { SimpleRegex } from '@adguard/tsurlfilter';

/**
 * Hostname patterns of allowlist entries, shared by frame matching and the canvas protection
 * policy so both describe an entry the same way.
 */
export class AllowlistPattern {
    /**
     * Optional `www.` subdomain of a plain entry, which the generated allowlist rule matches.
     */
    public static readonly WWW = String.raw`(?:www\.)?`;

    /**
     * Any number of subdomain labels, each ending with a dot.
     */
    public static readonly SUBDOMAINS = String.raw`(?:[^.]+\.)*`;

    /**
     * Builds the hostname pattern of an entry with a wildcard. A `*` matches any characters of the
     * hostname, as `HOST_WILDCARD` does in the generated allowlist rule, so it may cross label dots.
     *
     * @param domain Normalized entry without the `*.` prefix.
     * @param subdomains Whether the entry covers subdomains at any depth.
     *
     * @returns Hostname regular expression source.
     */
    public static hostname(domain: string, subdomains: boolean): string {
        const prefix = subdomains ? AllowlistPattern.SUBDOMAINS : AllowlistPattern.WWW;
        const pattern = SimpleRegex.escapeRegexSpecials(domain).replaceAll('\\*', '.*');

        return `${prefix}${pattern}`;
    }
}
