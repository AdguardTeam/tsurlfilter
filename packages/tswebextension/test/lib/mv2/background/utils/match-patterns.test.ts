import { describe, expect, it } from 'vitest';

import { MatchPatterns } from '../../../../../src/lib/mv2/background/utils/match-patterns';

describe('MatchPatterns', () => {
    it.each([
        ['<all_urls>', 'https://example.org/a?b#c', true],
        ['<all_urls>', 'file:///tmp/a.html', true],
        ['<all_urls>', 'about:blank', false],
        ['<all_urls>', 'chrome-extension://id/page.html', false],
        ['*://*/*', 'http://example.org:8080/', true],
        ['*://*/*', 'ftp://example.org/', false],
        ['https://*.example.org/*', 'https://example.org/', true],
        ['https://*.example.org/*', 'https://a.b.example.org/x', true],
        ['https://*.example.org/*', 'https://badexample.org/', false],
        ['https://*.example.org/*', 'http://example.org/', false],
        ['https://Example.org/a*', 'https://example.org/abc?q=1', true],
        ['https://example.org/a*', 'https://example.org/b?a', false],
        ['https://example.org/a', 'https://example.org/a#fragment', true],
        ['http://localhost:8080/*', 'http://localhost:8080/', true],
        ['http://localhost:8080/*', 'http://localhost:9090/', false],
        ['http://localhost:*/*', 'http://localhost:9090/', true],
        ['file:///tmp/*', 'file:///tmp/a.html', true],
    ])('%s matches %s: %s', (pattern, url, expected) => {
        expect(MatchPatterns.test(MatchPatterns.compile([pattern]), url)).toBe(expected);
    });

    it('matches any of several patterns and none of an empty list', () => {
        const compiled = MatchPatterns.compile(['https://a.org/*', 'https://b.org/*']);
        expect(MatchPatterns.test(compiled, 'https://b.org/')).toBe(true);
        expect(MatchPatterns.test(MatchPatterns.compile([]), 'https://a.org/')).toBe(false);
    });

    it.each(['example.org', 'https://example.org', 'https://exa*mple.org/', 'file://host/', 'https:///a', 'chrome://*/*'])(
        'rejects %s',
        (pattern) => {
            expect(() => MatchPatterns.compile([pattern])).toThrow('Invalid match pattern');
        },
    );
});
