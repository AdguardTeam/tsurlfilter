import { describe, expect, it } from 'vitest';

import {
    collectExceptionLines,
    type JsExclusions,
    resolveHostExclusions,
} from '../../../../../src/lib/mv3/background/preregistered-scripts/js-exclusions';

const HOSTNAMES = ['youtube.com', 'www.youtube.com'];

/**
 * Runs the scan over the given filter lists.
 *
 * @param lists Filter id and raw content of each source.
 * @param hostnames Hostnames to build exclusions for.
 *
 * @returns Scan result.
 */
const scan = (
    lists: { filterId: number; content: string }[],
    hostnames: string[] = HOSTNAMES,
): JsExclusions => resolveHostExclusions(
    lists.map(({ filterId, content }) => ({ filterId, lines: collectExceptionLines(content) })),
    hostnames,
);

describe('resolveHostExclusions', () => {
    it('turns a path-scoped $document exception into an excludeMatches pattern', () => {
        const { exclusions, dynamicHosts } = scan([{
            filterId: 2,
            content: '@@||youtube.com/my_video_ad$document\n',
        }]);

        // A `||` pattern accepts subdomains, and each host is registered on
        // its own, so both anchors get their own pattern.
        expect(exclusions.get('youtube.com')).toEqual(['*://youtube.com/my_video_ad*']);
        expect(exclusions.get('www.youtube.com')).toEqual(['*://www.youtube.com/my_video_ad*']);
        expect(dynamicHosts.size).toBe(0);
    });

    it('keeps a subdomain-only exception off the apex registration', () => {
        const { exclusions } = scan([{
            filterId: 2,
            content: '@@|https://www.youtube.com/ads$document\n',
        }]);

        // A scheme-anchored pattern never matches the apex, so excluding an
        // apex page would drop a page the engine does not disable. The
        // exclusion keeps the scheme of the rule: the engine disables JS on
        // https only.
        expect(exclusions.has('youtube.com')).toBe(false);
        expect(exclusions.get('www.youtube.com')).toEqual(['https://www.youtube.com/ads*']);
    });

    it('bakes every disabling exception of the host', () => {
        const { exclusions } = scan([{
            filterId: 2,
            content: '@@||youtube.com/ads$document\n@@||youtube.com/shorts$jsinject\n',
        }]);

        expect(exclusions.get('youtube.com'))
            .toEqual(['*://youtube.com/ads*', '*://youtube.com/shorts*']);
    });

    it('keeps a host dynamic when the exception cannot be expressed as a pattern', () => {
        const { exclusions, dynamicHosts } = scan([{
            filterId: 2,
            content: '@@||youtube.com/*.php?__query=$document\n',
        }]);

        // A query (and a wildcard inside the path) has no match-pattern form:
        // the registration would exclude nothing, so the host keeps the
        // dynamic path where the engine has the final say.
        expect(exclusions.size).toBe(0);
        expect(dynamicHosts.get('youtube.com')).toContain('cannot be expressed as an excludeMatches pattern');
    });

    it('keeps a host dynamic when an exception disables every URL of it', () => {
        const { exclusions, dynamicHosts } = scan([{
            filterId: 2,
            content: '@@||youtube.com^$document\n',
        }]);

        // Excluding `*://youtube.com/*` would be the same as not registering
        // the host at all, which is what the dynamic path does.
        expect(exclusions.size).toBe(0);
        expect(dynamicHosts.get('youtube.com')).toBe('@@||youtube.com^$document');
    });

    it('ignores an exception of another site', () => {
        const { exclusions, dynamicHosts } = scan([{
            filterId: 2,
            content: '@@||example.org/ads$document\n',
        }]);

        expect(exclusions.size).toBe(0);
        expect(dynamicHosts.size).toBe(0);
    });

    it('ignores an exception that does not disable JS injection', () => {
        // `$elemhide` disables cosmetic filtering only, and a blocking rule
        // is not an exception at all.
        const { exclusions } = scan([{
            filterId: 2,
            content: '@@||youtube.com/ads$elemhide\n||youtube.com/ads\n',
        }]);

        expect(exclusions.size).toBe(0);
    });

    it('resolves a $badfilter of another enabled filter', () => {
        const { exclusions, dynamicHosts } = scan([
            { filterId: 2, content: '@@||youtube.com/my_video_ad$document\n' },
            { filterId: 3, content: '@@||youtube.com/my_video_ad$document,badfilter\n' },
        ]);

        // Only the enabled filters are scanned, so the cancellation is final
        // and nothing is excluded — no need to drop the host.
        expect(exclusions.size).toBe(0);
        expect(dynamicHosts.size).toBe(0);
    });

    it('bakes nothing when the exception is cancelled inside its own filter', () => {
        const { exclusions, dynamicHosts } = scan([{
            filterId: 2,
            content: '@@||youtube.com/my_video_ad$document\n@@||youtube.com/my_video_ad$document,badfilter\n',
        }]);

        expect(exclusions.size).toBe(0);
        expect(dynamicHosts.size).toBe(0);
    });

    it('keeps a host dynamic when a higher-ranked exception shields the page', () => {
        const { exclusions, dynamicHosts } = scan([{
            filterId: 2,
            content: '@@||youtube.com^$urlblock\n@@||youtube.com/video$jsinject\n',
        }]);

        // Which page the priority decides is a per-URL question the
        // registration cannot answer, so the host keeps the engine's verdict.
        expect(exclusions.size).toBe(0);
        expect(dynamicHosts.get('youtube.com')).toContain('a higher-ranked exception keeps JS injection on');
    });

    it('is not shielded by an exception of another site', () => {
        // A keeping exception of another site reaches the cosmetic slot but
        // not this host, so it must not outrank the disabling one and send
        // the host to the dynamic path.
        const { exclusions, dynamicHosts } = scan([{
            filterId: 2,
            content: '@@||example.org^$generichide\n@@||youtube.com/video$jsinject\n',
        }]);

        expect(dynamicHosts.size).toBe(0);
        expect(exclusions.get('youtube.com')).toEqual(['*://youtube.com/video*']);
    });

    it('keeps the scheme of a scheme-anchored exception', () => {
        const { exclusions } = scan([{
            filterId: 2,
            content: '@@|http://youtube.com/ads$document\n',
        }]);

        // The engine disables JS on the http page only, and the registration
        // matches both schemes, so an any-scheme exclusion would drop rules
        // on the https page the engine allows.
        expect(exclusions.get('youtube.com')).toEqual(['http://youtube.com/ads*']);
    });

    it('treats a bare host token as the host the author meant', () => {
        const { exclusions } = scan([{
            filterId: 2,
            content: '@@youtube.com/ads$document\n',
        }]);

        // A bare pattern is a substring search: it matches the host it starts
        // with and, being unanchored, every subdomain of it.
        expect(exclusions.get('youtube.com')).toEqual(['*://youtube.com/ads*']);
        expect(exclusions.get('www.youtube.com')).toEqual(['*://www.youtube.com/ads*']);
    });

    it('keeps a host dynamic when a bare pattern disables every URL of it', () => {
        const { exclusions, dynamicHosts } = scan([{
            filterId: 2,
            content: '@@youtube.com^$document\n',
        }]);

        // Without the `||` anchor the rule still matches the host and its
        // subdomains: the host cannot be registered at all.
        expect(exclusions.size).toBe(0);
        expect(dynamicHosts.get('youtube.com')).toBe('@@youtube.com^$document');
        expect(dynamicHosts.get('www.youtube.com')).toBe('@@youtube.com^$document');
    });

    it('reads a leading dot as "a label is required"', () => {
        const { exclusions, dynamicHosts } = scan([{
            filterId: 2,
            content: '@@.youtube.com/ads$document\n',
        }]);

        // The dot is part of the substring, so the rule matches
        // `www.youtube.com/ads` but not `youtube.com/ads`.
        expect(dynamicHosts.size).toBe(0);
        expect(exclusions.has('youtube.com')).toBe(false);
        expect(exclusions.get('www.youtube.com')).toEqual(['*://www.youtube.com/ads*']);
    });

    it('keeps a host dynamic when a wildcard or truncated host reaches it', () => {
        const wildcard = scan([{
            filterId: 2,
            content: '@@||*.youtube.com/ads$document\n',
        }]);
        const truncated = scan([{
            filterId: 2,
            content: '@@||youtube.$document\n',
        }]);

        // Both reach the host in the engine (a wildcard host and a truncated
        // host part are prefixes of the hostname), but no match-pattern
        // anchor can pin the exclusion to the registered host.
        expect(wildcard.dynamicHosts.get('www.youtube.com')).toContain('not anchored to its name');
        expect(truncated.dynamicHosts.has('youtube.com')).toBe(true);
    });

    it('keeps a host dynamic when an exception matches every URL', () => {
        const { exclusions, dynamicHosts } = scan([{ filterId: 2, content: '@@$jsinject\n' }]);

        // `@@$jsinject` disables JS everywhere; no registration is safe.
        expect(exclusions.size).toBe(0);
        expect(dynamicHosts.get('youtube.com')).toContain('matches every URL');
    });

    it('ignores a document-slot exception the engine cannot match on a main frame', () => {
        // `@@*` has neither a hostname nor a shortcut, so the engine files it
        // in the domains table; that table cannot match a main-frame request
        // (it has no source), so the exception never decides the JS verdict
        // there — and it must not shield the disabling one either.
        const { exclusions, dynamicHosts } = scan([{
            filterId: 2,
            content: '@@*$urlblock,domain=youtube.com\n@@||youtube.com/video$jsinject\n',
        }]);

        expect(dynamicHosts.size).toBe(0);
        expect(exclusions.get('youtube.com')).toEqual(['*://youtube.com/video*']);
    });

    it('reports host-less exceptions instead of baking them', () => {
        const { exclusions, dynamicHosts, unanchoredExceptions } = scan([{
            filterId: 2,
            content: '@@/prison/universal.php$document\n',
        }]);

        // A pattern without a host matches any site, so no single exclusion
        // can express it; the host keeps its registration.
        expect(exclusions.size).toBe(0);
        expect(dynamicHosts.size).toBe(0);
        expect(unanchoredExceptions).toEqual(['@@/prison/universal.php$document']);
    });

    it('keeps the scheme of a scheme-anchored exception and its host scope', () => {
        const { exclusions } = scan([{
            filterId: 2,
            content: '@@|http://youtube.com/ads$document\n',
        }]);

        // A `|scheme://` anchor pins the scheme and does not accept
        // subdomains, so only the apex gets an http-only exclusion.
        expect(exclusions.get('youtube.com')).toEqual(['http://youtube.com/ads*']);
        expect(exclusions.has('www.youtube.com')).toBe(false);
    });

    it('keeps a host dynamic when the path is written in uppercase', () => {
        const { exclusions, dynamicHosts } = scan([{
            filterId: 2,
            content: '@@||youtube.com/MyVideo$document\n',
        }]);

        // The browser compares the exclusion path case-sensitively while the
        // engine does not, so one spelling would leave `/myvideo` uncovered.
        expect(exclusions.size).toBe(0);
        expect(dynamicHosts.get('youtube.com'))
            .toContain('cannot be expressed as an excludeMatches pattern');
    });

    it('keeps an uppercase path when the exception is $match-case', () => {
        const { exclusions, dynamicHosts } = scan([{
            filterId: 2,
            content: '@@||youtube.com/MyVideo$document,match-case\n',
        }]);

        // `$match-case` makes the engine case-sensitive too, so the written
        // spelling is the whole exclusion.
        expect(exclusions.get('youtube.com')).toEqual(['*://youtube.com/MyVideo*']);
        expect(dynamicHosts.size).toBe(0);
    });

    it('ignores a keeping exception of another site', () => {
        const { exclusions, dynamicHosts } = scan([{
            filterId: 2,
            content: '@@adsense.google.com/ads$generichide\n@@||youtube.com/video$jsinject\n',
        }]);

        // A bare `host/path` token also occurs inside the URLs of every other
        // host, but the rule is about another site: it must not keep JS
        // injection on here.
        expect(dynamicHosts.size).toBe(0);
        expect(exclusions.get('youtube.com')).toEqual(['*://youtube.com/video*']);
    });

    it('does not shield with a lower-ranked keeping exception', () => {
        const { exclusions } = scan([{
            filterId: 2,
            content: '@@||youtube.com/video$document,important\n@@||youtube.com/other$generichide\n',
        }]);

        expect(exclusions.get('youtube.com')).toEqual(['*://youtube.com/video*']);
    });

    it('deduplicates the pattern two exceptions produce', () => {
        const { exclusions } = scan([{
            filterId: 2,
            content: '@@||youtube.com/ads$document\n@@||youtube.com/ads$jsinject\n',
        }]);

        expect(exclusions.get('youtube.com')).toEqual(['*://youtube.com/ads*']);
    });

    it('matches a $domain of a document exception against the page itself', () => {
        const { exclusions } = scan([{
            filterId: 2,
            content: '@@||youtube.com/ads$document,domain=youtube.com\n@@||youtube.com/other$jsinject\n',
        }]);

        // The engine tests `$domain` of a document rule with a host-scoped
        // pattern against the request hostname, and the page request is the
        // request here.
        expect(exclusions.get('youtube.com'))
            .toEqual(['*://youtube.com/ads*', '*://youtube.com/other*']);
    });

    it('keeps a host dynamic when a $domain cosmetic exception competes', () => {
        const { exclusions, dynamicHosts } = scan([{
            filterId: 2,
            content: '@@||youtube.com/ads$generichide,domain=youtube.com\n@@||youtube.com/other$jsinject\n',
        }]);

        // The cosmetic slot has a source, so the exception matches and ranks
        // equal to the disabling one: the winner depends on the page.
        expect(exclusions.size).toBe(0);
        expect(dynamicHosts.size).toBe(2);
    });

    it('leaves a third-party exception out and keeps a first-party one', () => {
        const thirdParty = scan([{
            filterId: 2,
            content: '@@||youtube.com/ads$document,third-party\n@@||youtube.com/other$jsinject\n',
        }]);
        const firstParty = scan([{
            filterId: 2,
            content: '@@||youtube.com/ads$document,~third-party\n@@||youtube.com/other$jsinject\n',
        }]);

        // A main-frame document is first-party to itself.
        expect(thirdParty.exclusions.get('youtube.com')).toEqual(['*://youtube.com/other*']);
        expect(firstParty.exclusions.get('youtube.com'))
            .toEqual(['*://youtube.com/ads*', '*://youtube.com/other*']);
    });

    it('keeps a host dynamic when the exception covers every URL with a wildcard path', () => {
        const { exclusions, dynamicHosts } = scan([{
            filterId: 2,
            content: '@@||youtube.com/*$document\n',
        }]);

        expect(exclusions.size).toBe(0);
        expect(dynamicHosts.get('youtube.com'))
            .toContain('cannot be expressed as an excludeMatches pattern');
    });
});
