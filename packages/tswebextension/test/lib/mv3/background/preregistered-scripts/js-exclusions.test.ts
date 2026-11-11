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
        // apex page would drop a page the engine does not disable.
        expect(exclusions.has('youtube.com')).toBe(false);
        expect(exclusions.get('www.youtube.com')).toEqual(['*://www.youtube.com/ads*']);
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
});
