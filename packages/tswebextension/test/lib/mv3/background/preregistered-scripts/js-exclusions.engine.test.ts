import { describe, expect, it } from 'vitest';

import {
    CosmeticOption,
    Engine,
    Request,
    RequestType,
} from '@adguard/tsurlfilter';

import {
    collectExceptionLines,
    resolveHostExclusions,
} from '../../../../../src/lib/mv3/background/preregistered-scripts/js-exclusions';

/**
 * Hostnames of a registration in the tests below.
 */
const HOSTS = ['youtube.com', 'www.youtube.com'];

/**
 * Paths every case is checked on.
 */
const PATHS = ['/', '/ads', '/watch', '/my_video_ad'];

/**
 * Rule sets whose verdict the engine and the scan must agree on.
 *
 * `dynamic` pins which hosts the scan sends to the dynamic path: a dynamic
 * host is decided by the engine, so the differential loop below cannot fail
 * there, and without the expected set a case that made every host dynamic
 * would assert nothing.
 *
 * The shapes that stay out are the documented divergences: an uppercase
 * spelling of an excluded path, a bare pattern of another site, a URL with an
 * explicit port and a host-less exception that misses the root page.
 */
const CASES: { name: string; content: string; dynamic: string[] }[] = [
    { name: 'path-scoped document exception', content: '@@||youtube.com/my_video_ad$document', dynamic: [] },
    { name: 'jsinject exception', content: '@@||youtube.com/ads$jsinject', dynamic: [] },
    { name: 'match-case exception', content: '@@||youtube.com/ads$document,match-case', dynamic: [] },
    { name: 'scheme-anchored exception', content: '@@|https://youtube.com/ads$document', dynamic: [] },
    { name: 'scheme substring exception', content: '@@://youtube.com/ads$document', dynamic: HOSTS },
    { name: 'bare host/path exception', content: '@@youtube.com/ads$document', dynamic: HOSTS },
    { name: 'leading-dot exception', content: '@@.youtube.com/ads$document', dynamic: HOSTS },
    { name: 'wildcard host exception', content: '@@||*.youtube.com/ads$document', dynamic: ['www.youtube.com'] },
    { name: 'wildcard host under a subdomain', content: '@@||youtu*.com/ads$document', dynamic: HOSTS },
    { name: 'wildcard top-level domain', content: '@@||youtube.*/ads$document', dynamic: HOSTS },
    { name: 'wildcard scheme', content: '@@|*://youtube.com/ads$document', dynamic: [] },
    { name: 'https-only wildcard scheme', content: '@@|h*ps://youtube.com/ads$document', dynamic: [] },
    {
        name: 'uppercase scheme with $match-case',
        content: '@@|HTTPS://youtube.com/ads$document,match-case',
        dynamic: ['youtube.com'],
    },
    { name: 'uppercase host', content: '@@||YouTube.com/ads$document', dynamic: HOSTS },
    { name: 'regexp $domain', content: '@@/watch$document,domain=/youtu.*/', dynamic: HOSTS },
    { name: 'wildcard $domain', content: '@@/watch$document,domain=youtube.*', dynamic: HOSTS },
    { name: 'restricted-only $domain', content: '@@/watch$document,domain=~foo.com', dynamic: HOSTS },
    { name: 'restricted $domain excludes the host', content: '@@/watch$document,domain=~youtube.com', dynamic: [] },
    {
        name: 'host-wide keeping exception',
        content: '@@||youtube.com^$generichide\n@@||youtube.com/watch$jsinject',
        dynamic: HOSTS,
    },
    {
        name: 'cancelled exception',
        content: '@@||youtube.com/ads$document\n@@||youtube.com/ads$document,badfilter',
        dynamic: [],
    },
    { name: 'host-wide document exception', content: '@@||youtube.com^$document', dynamic: HOSTS },
    {
        name: 'host-less keeping exception',
        content: '@@/ads$elemhide,important\n@@||youtube.com/ads$jsinject',
        dynamic: HOSTS,
    },
    {
        name: 'host-less keeping exception without $important',
        content: '@@/ads$elemhide\n@@||youtube.com/ads$jsinject',
        dynamic: HOSTS,
    },
    {
        name: 'host-less urlblock exception',
        content: '@@/ads$urlblock,important\n@@||youtube.com/ads$jsinject',
        dynamic: HOSTS,
    },
    { name: 'wildcard token running into the path', content: '@@||youtube.com*ads$document', dynamic: HOSTS },
    {
        name: 'wildcard token running into a nested path',
        content: '@@||youtube.com*ads/foo$document',
        dynamic: HOSTS,
    },
    { name: 'wildcard token of another site', content: '@@||tube.com*ads$document', dynamic: [] },
    { name: 'host-less keeping exception with $domain', content: '@@$generichide,domain=youtube.com', dynamic: [] },
    {
        name: 'unanchored keeping exception with a wildcard host',
        content: '@@||youtube.*^$generichide',
        dynamic: [],
    },
    { name: 'scheme-anchored host-wide exception', content: '@@|https://youtube.com^$document', dynamic: [] },
    { name: 'scheme-anchored root-page exception', content: '@@|https://youtube.com/$document', dynamic: [] },
];

/**
 * Mirrors the browser's match-pattern comparison, probed in Chromium: the path
 * is compared case-sensitively and the port is a wildcard when the pattern has
 * none.
 *
 * @param pattern `excludeMatches` entry.
 * @param url Page URL.
 *
 * @returns True when the browser would skip the content script on the URL.
 */
const matchesExcludePattern = (pattern: string, url: string): boolean => {
    const parsed = /^(\*|https?):\/\/([^/]+)(\/.*)$/.exec(pattern);
    if (!parsed) {
        return false;
    }

    const [, scheme, host, path] = parsed;
    const target = new URL(url);

    if (scheme !== '*' && target.protocol !== `${scheme}:`) {
        return false;
    }

    if (target.hostname !== host) {
        return false;
    }

    const prefix = path.endsWith('*') ? path.slice(0, -1) : path;

    return (target.pathname + target.search + target.hash).startsWith(prefix);
};

describe('resolveHostExclusions against the engine', () => {
    it.each(CASES)('agrees with the engine on $name', async ({ content, dynamic }) => {
        const engine = await Engine.createAsync({ filters: [{ id: 1, content }] });
        const { exclusions, dynamicHosts } = resolveHostExclusions(
            [{ filterId: 1, lines: collectExceptionLines(content) }],
            HOSTS,
        );

        // The hosts the scan sends to the dynamic path are the assertion for
        // that branch: the engine decides there, so the loop cannot check it.
        expect([...dynamicHosts.keys()].sort()).toEqual([...dynamic].sort());

        for (const host of HOSTS) {
            for (const path of PATHS) {
                const url = `https://${host}${path}`;
                const frameRule = engine.matchFrame(url);
                const option = engine
                    .matchRequest(new Request(url, url, RequestType.Document), frameRule ?? undefined)
                    .getCosmeticOption();
                const engineDisables = (option & CosmeticOption.CosmeticOptionJS) === 0;

                // A dynamic host is decided by the engine, so it always agrees.
                if (dynamicHosts.has(host)) {
                    continue;
                }

                const scanDisables = (exclusions.get(host) ?? [])
                    .some((pattern) => matchesExcludePattern(pattern, url));

                expect(scanDisables, `${url} with ${content}`).toBe(engineDisables);
            }
        }
    });
});
