import { describe, expect, it } from 'vitest';

import { matchesHostScope } from '../../../../../src/lib/mv3/background/preregistered-scripts/host-scope';

/**
 * Pins the reach predicate of the runtime exclusion scan: it picks the rules a
 * host's registration has to exclude. A change here silently changes the
 * preregistration coverage, so every branch is spelled out.
 */
describe('matchesHostScope', () => {
    it.each([
        // `||`-anchored patterns.
        ['||youtube.com^', 'youtube.com', true],
        ['||youtube.com^', 'www.youtube.com', true],
        ['||youtube.com^', 'notyoutube.com', false],
        ['||youtube.com/path', 'youtube.com', true],
        ['||youtube.com:8080^', 'youtube.com', true],
        // A host part without a terminator may be followed by anything.
        ['||youtube', 'youtube.com', true],
        ['||youtube', 'www.youtube.com', true],
        // A wildcard can span into the path, so only its literal prefix counts.
        ['||you*', 'youtube.com', true],
        ['||you*', 'example.org', false],
        ['||*.youtube.com', 'youtube.com', true],
        ['||youtube.*', 'youtube.com', true],
        // Scheme-anchored patterns.
        ['|https://youtube.com/|', 'youtube.com', true],
        ['|https://youtube.com/|', 'www.youtube.com', false],
        ['|https://youtube.com/ads', 'youtube.com', true],
        ['|https://example.org/', 'youtube.com', false],
        // Unanchored patterns can match inside a URL of any host.
        ['/watch', 'youtube.com', true],
        ['example', 'youtube.com', true],
        ['://youtube.com/', 'youtube.com', true],
        // A `|`-anchored pattern without a scheme is still an unanchored match
        // for the host part: over-inclusion is the safe direction.
        ['|youtube.com^', 'youtube.com', true],
        // A port is part of the pattern's authority, not of the hostname.
        ['||youtube.com:8080/path', 'youtube.com', true],
        // The pattern's host part is compared case-insensitively.
        ['||YouTube.com^', 'youtube.com', true],
    ])('matches %s for %s: %s', (pattern, hostname, expected) => {
        expect(matchesHostScope(pattern, hostname)).toBe(expected);
    });
});
