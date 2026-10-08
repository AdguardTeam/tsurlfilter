/**
 * Evaluates extension match patterns where the browser does not apply them itself.
 *
 * @see {@link https://developer.chrome.com/docs/extensions/develop/concepts/match-patterns}
 */
export class MatchPatterns {
    /**
     * Scheme, host with an optional port, and path of a match pattern.
     */
    private static readonly PATTERN = /^(\*|https?|file|ftp):\/\/(\*|(?:\*\.)?[^/*:]+(?::(?:\d+|\*))?)?(\/.*)$/;

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
        return compiled.test(`${parsed.protocol}//${parsed.host}${parsed.pathname}${parsed.search}`);
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
            return '(?:https?|file|ftp)://.*';
        }
        const parts = MatchPatterns.PATTERN.exec(pattern);
        if (!parts) {
            throw new Error(`Invalid match pattern: ${pattern}`);
        }
        const [, scheme, host = '', path] = parts;
        if ((scheme === 'file') !== (host === '')) {
            throw new Error(`Invalid match pattern: ${pattern}`);
        }
        const escape = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        let hostSource = '';
        if (host === '*') {
            hostSource = '[^/]*';
        } else if (host !== '') {
            const [name, port] = host.toLowerCase().split(':');
            hostSource = name.startsWith('*.')
                ? `(?:[^/:]+\\.)?${escape(name.slice(2))}`
                : escape(name);
            // Without a port, or with `*`, a pattern matches any port.
            hostSource += port === undefined || port === '*' ? '(?::\\d+)?' : `:${port}`;
        }
        const schemeSource = scheme === '*' ? 'https?' : scheme;
        return `${schemeSource}://${hostSource}${path.split('*').map(escape).join('.*')}`;
    }
}
