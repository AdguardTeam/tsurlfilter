import { describe, expect, it } from 'vitest';

import {
    computePageExceptionsFingerprint,
    type PreregisteredFilterList,
} from '../../../../../src/lib/mv3/background/preregistered-scripts/exception-fingerprint';

/**
 * Hostnames the generation covers in these tests.
 */
const HOSTS = ['youtube.com', 'www.youtube.com'];

/**
 * Wraps one filter list.
 *
 * @param content Filter list content.
 * @param filterId Filter id.
 *
 * @returns Lists argument of the fingerprint.
 */
const list = (content: string, filterId = 2): PreregisteredFilterList[] => [{ filterId, content }];

/**
 * Fingerprints one list.
 *
 * @param content Filter list content.
 * @param hostnames Covered hostnames.
 *
 * @returns Fingerprint of filter 2.
 */
const fingerprint = async (content: string, hostnames: string[] = HOSTS): Promise<string> => {
    const result = await computePageExceptionsFingerprint(list(content), hostnames);
    return result['2'];
};

describe('computePageExceptionsFingerprint', () => {
    it('is stable for the same rules and does not depend on the line order', async () => {
        const first = await fingerprint([
            '@@||youtube.com/my_video_ad$document',
            '@@||youtube.com^$generichide',
        ].join('\n'));
        const second = await fingerprint([
            '@@||youtube.com^$generichide',
            '@@||youtube.com/my_video_ad$document',
        ].join('\n'));

        expect(first).toBe(second);
    });

    it('changes when an exception is added or removed', async () => {
        const base = await fingerprint('@@||youtube.com^$jsinject');
        const added = await fingerprint([
            '@@||youtube.com^$jsinject',
            '@@||youtube.com/embed/$jsinject',
        ].join('\n'));
        const removed = await fingerprint('');

        expect(new Set([base, added, removed]).size).toBe(3);
    });

    it('keeps one entry per filter, so a disabled filter does not invalidate the others', async () => {
        const both = await computePageExceptionsFingerprint([
            { filterId: 2, content: '@@||youtube.com^$document' },
            { filterId: 3, content: '@@||youtube.com^$generichide' },
        ], HOSTS);
        const onlyFilterTwo = await computePageExceptionsFingerprint([
            { filterId: 2, content: '@@||youtube.com^$document' },
        ], HOSTS);

        // The enabled filters are compared one by one: an entry missing from
        // the runtime map is simply not compared.
        expect(onlyFilterTwo['2']).toBe(both['2']);
        expect(both['3']).toBeDefined();
    });

    it('ignores rules the page gate does not depend on', async () => {
        const base = await fingerprint('@@||youtube.com^$jsinject');
        const withNoise = await fingerprint([
            '@@||youtube.com^$jsinject',
            '||ads.example.com^',
            '@@||youtube.com^$script',
        ].join('\n'));

        expect(withNoise).toBe(base);
    });

    it('gives an empty list the same fingerprint as a list without exceptions', async () => {
        const empty = await fingerprint('');
        const noise = await fingerprint('||ads.example.com^');

        expect(empty).toBe(noise);
    });

    it.each([
        [
            'a modifier value',
            '@@||youtube.com^$document,domain=youtube.com',
            '@@||youtube.com^$document,domain=example.org',
        ],
        [
            'the third-party flag',
            '@@||youtube.com^$document,third-party',
            '@@||youtube.com^$document,~third-party',
        ],
        ['$match-case', '@@||youtube.com^$elemhide,match-case', '@@||youtube.com^$elemhide'],
        ['the priority weight', '@@||youtube.com^$generichide', '@@||youtube.com^$generichide,important'],
        ['the JS flag', '@@||youtube.com^$generichide', '@@||youtube.com^$jsinject'],
        ['the document slot', '@@||youtube.com^$generichide', '@@||youtube.com^$document'],
    ])('changes when %s changes the engine verdict', async (_name, first, second) => {
        expect(await fingerprint(first)).not.toBe(await fingerprint(second));
    });

    it('ignores exceptions that cannot reach a covered hostname', async () => {
        const base = await fingerprint('@@||youtube.com^$document');
        const withOtherSite = await fingerprint([
            '@@||youtube.com^$document',
            // A base-list update that has nothing to do with the covered hosts.
            '@@||example.org^$generichide',
            '@@||example.org/ads$jsinject',
        ].join('\n'));

        expect(withOtherSite).toBe(base);
    });

    it('counts the same rule once the hostname is covered', async () => {
        const base = await fingerprint('@@||youtube.com^$document');
        const covered = await fingerprint('@@||youtube.com^$document', [...HOSTS, 'example.org']);
        const withOtherSite = await fingerprint(
            ['@@||youtube.com^$document', '@@||example.org^$generichide'].join('\n'),
            [...HOSTS, 'example.org'],
        );

        // The scope itself is not part of the hash, only the rules it keeps.
        expect(covered).toBe(base);
        expect(withOtherSite).not.toBe(base);
    });
});
