import { SimpleRegex } from '@adguard/tsurlfilter';

/**
 * Evaluates extension match patterns where the browser does not apply them itself.
 * Used by Chromium MV2 canvas protection only. Hosts are compared as Chromium does:
 * IDN hosts in punycode, without a trailing dot, and a default port matches the
 * same port given explicitly. Of `file:` patterns only `file:///path` is supported:
 * Chromium also accepts `file://*` and `file://host/path`, taking everything after
 * `file://` as the path, but other MV2 features do not run on `file:` pages either.
 *
 * TODO: remove when Chromium MV2 is no longer supported.
 *
 * @see {@link https://developer.chrome.com/docs/extensions/develop/concepts/match-patterns}
 */
export class MatchPatterns {
    /**
     * Schemes matched by `<all_urls>`. A pattern may name one of them or `*`.
     */
    private static readonly SCHEMES = ['http', 'https', 'file', 'ftp'];

    /**
     * Schemes matched by the `*` scheme.
     */
    private static readonly WILDCARD_SCHEMES = ['http', 'https'];

    /**
     * Ports a URL of a scheme has when it names none.
     */
    private static readonly DEFAULT_PORTS: Readonly<Record<string, string>> = {
        http: '80',
        https: '443',
        ftp: '21',
    };

    /**
     * Scheme, host (`*`, or an optional `*.` prefix and a name or a bracketed IPv6 address),
     * an optional port or `*`, and path of a match pattern.
     */
    private static readonly PATTERN = /^([a-z]+|\*):\/\/(?:(\*)|(\*\.)?(\[[^\]/]+\]|[^/*:[\]]+))?(?::(\d+|\*))?(\/.*)$/;

    /**
     * Compiles patterns into one expression for {@link MatchPatterns.test}.
     *
     * @param patterns Match patterns, such as `<all_urls>` or `*://*.example.org/*`.
     *
     * @returns Expression that matches a URL of any of the patterns.
     *
     * @throws When a pattern is invalid, as the browser rejects it at registration.
     */
    public static compile(patterns: readonly string[]): RegExp {
        if (patterns.length === 0) {
            return /(?!)/;
        }
        return new RegExp(`^(?:${patterns.map(MatchPatterns.toSource).join('|')})$`);
    }

    /**
     * Tests a document URL. The fragment is not matched.
     *
     * @param compiled Expression from {@link MatchPatterns.compile}.
     * @param url Document URL.
     *
     * @returns Whether the URL matches.
     */
    public static test(compiled: RegExp, url: string): boolean {
        let parsed: URL;
        try {
            parsed = new URL(url);
        } catch {
            return false;
        }
        const scheme = parsed.protocol.slice(0, -1);
        const port = parsed.port || MatchPatterns.DEFAULT_PORTS[scheme];
        const host = `${MatchPatterns.normalizeHost(parsed.hostname)}${port ? `:${port}` : ''}`;
        return compiled.test(`${scheme}://${host}${parsed.pathname}${parsed.search}`);
    }

    /**
     * Converts one pattern into an expression source.
     *
     * @param pattern Match pattern.
     *
     * @returns Expression source without anchors.
     *
     * @throws When the pattern is invalid.
     */
    private static toSource(pattern: string): string {
        if (pattern === '<all_urls>') {
            return `(?:${MatchPatterns.SCHEMES.join('|')})://.*`;
        }
        const parts = MatchPatterns.PATTERN.exec(pattern);
        if (!parts) {
            throw new Error(`Invalid match pattern: ${pattern}`);
        }
        const [, scheme, anyHost, subdomains, name, port, path] = parts;
        const hasHost = anyHost !== undefined || name !== undefined;
        if ((scheme !== '*' && !MatchPatterns.SCHEMES.includes(scheme))
            || (scheme === 'file') === hasHost
            || (!hasHost && port !== undefined)) {
            throw new Error(`Invalid match pattern: ${pattern}`);
        }
        let hostSource = '';
        if (anyHost !== undefined) {
            hostSource = port === undefined || port === '*' ? '[^/]*' : `[^/:]*:${port}`;
        } else if (name !== undefined) {
            let hostname: string;
            try {
                hostname = MatchPatterns.normalizeHost(new URL(`http://${name}`).hostname);
            } catch {
                throw new Error(`Invalid match pattern: ${pattern}`);
            }
            hostSource = `${subdomains ? '(?:[^/:]+\\.)?' : ''}${SimpleRegex.escapeRegexSpecials(hostname)}`;
            // Without a port, or with `*`, a pattern matches any port.
            hostSource += port === undefined || port === '*' ? '(?::\\d+)?' : `:${port}`;
        }
        const schemeSource = scheme === '*' ? `(?:${MatchPatterns.WILDCARD_SCHEMES.join('|')})` : scheme;
        const pathSource = path.split('*').map((part) => SimpleRegex.escapeRegexSpecials(part)).join('.*');
        return `${schemeSource}://${hostSource}${pathSource}`;
    }

    /**
     * Drops the trailing dot of a fully qualified host name.
     *
     * @param hostname Host name as `URL` returns it.
     *
     * @returns The host name without a trailing dot.
     */
    private static normalizeHost(hostname: string): string {
        return hostname.endsWith('.') ? hostname.slice(0, -1) : hostname;
    }
}
