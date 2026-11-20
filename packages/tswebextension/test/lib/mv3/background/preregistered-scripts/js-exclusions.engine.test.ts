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
 * The shapes that stay out are the documented divergences: an uppercase
 * spelling of an excluded path, a bare pattern of another site, a URL with an
 * explicit port and a host-less exception that misses the root page.
 */
const CASES: { name: string; content: string }[] = [
    { name: 'path-scoped document exception', content: '@@||youtube.com/my_video_ad$document' },
    { name: 'jsinject exception', content: '@@||youtube.com/ads$jsinject' },
    { name: 'match-case exception', content: '@@||youtube.com/ads$document,match-case' },
    { name: 'scheme-anchored exception', content: '@@|https://youtube.com/ads$document' },
    { name: 'scheme substring exception', content: '@@://youtube.com/ads$document' },
    { name: 'bare host/path exception', content: '@@youtube.com/ads$document' },
    { name: 'leading-dot exception', content: '@@.youtube.com/ads$document' },
    { name: 'wildcard host exception', content: '@@||*.youtube.com/ads$document' },
    { name: 'wildcard host under a subdomain', content: '@@||youtu*.com/ads$document' },
    { name: 'wildcard top-level domain', content: '@@||youtube.*/ads$document' },
    { name: 'wildcard scheme', content: '@@|*://youtube.com/ads$document' },
    { name: 'https-only wildcard scheme', content: '@@|h*ps://youtube.com/ads$document' },
    { name: 'uppercase scheme with $match-case', content: '@@|HTTPS://youtube.com/ads$document,match-case' },
    { name: 'uppercase host', content: '@@||YouTube.com/ads$document' },
    { name: 'regexp $domain', content: '@@/watch$document,domain=/youtu.*/' },
    { name: 'wildcard $domain', content: '@@/watch$document,domain=youtube.*' },
    { name: 'restricted-only $domain', content: '@@/watch$document,domain=~foo.com' },
    { name: 'restricted $domain excludes the host', content: '@@/watch$document,domain=~youtube.com' },
    { name: 'host-wide keeping exception', content: '@@||youtube.com^$generichide\n@@||youtube.com/watch$jsinject' },
    { name: 'cancelled exception', content: '@@||youtube.com/ads$document\n@@||youtube.com/ads$document,badfilter' },
    { name: 'host-wide document exception', content: '@@||youtube.com^$document' },
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
    it.each(CASES)('agrees with the engine on $name', async ({ content }) => {
        const engine = await Engine.createAsync({ filters: [{ id: 1, content }] });
        const { exclusions, dynamicHosts } = resolveHostExclusions(
            [{ filterId: 1, lines: collectExceptionLines(content) }],
            HOSTS,
        );

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
