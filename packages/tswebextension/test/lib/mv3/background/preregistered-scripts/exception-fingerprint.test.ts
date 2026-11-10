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
    it('is stable for the same rules', async () => {
        const content = [
            '@@||youtube.com^$generichide',
            '@@||youtube.com/watch$jsinject',
        ].join('\n');

        expect(await fingerprint(content)).toBe(await fingerprint(content));
    });

    it('changes when the rules are reordered', async () => {
        // Two exceptions of one hostname-table key tie, and the engine breaks
        // the tie by the list order: `$generichide` first keeps JS enabled on
        // the page, `$jsinject` first disables it.
        const generichideFirst = await fingerprint([
            '@@||youtube.com^$generichide',
            '@@||youtube.com/watch$jsinject',
        ].join('\n'));
        const jsinjectFirst = await fingerprint([
            '@@||youtube.com/watch$jsinject',
            '@@||youtube.com^$generichide',
        ].join('\n'));

        expect(generichideFirst).not.toBe(jsinjectFirst);

        // Same tie on a path-scoped pair: the hostname table keys both rules
        // by `youtube.com`, the path is checked after the lookup, so only the
        // list order decides.
        expect(await fingerprint([
            '@@||youtube.com/watch$generichide',
            '@@||youtube.com/watch?v=$jsinject',
        ].join('\n'))).not.toBe(await fingerprint([
            '@@||youtube.com/watch?v=$jsinject',
            '@@||youtube.com/watch$generichide',
        ].join('\n')));
    });

    it('does not depend on the order the covered hostnames are given in', async () => {
        const content = '@@||youtube.com^$generichide';

        expect(await fingerprint(content, ['www.youtube.com', 'youtube.com']))
            .toBe(await fingerprint(content, ['youtube.com', 'www.youtube.com']));
    });

    it('changes when a covered hostname is added or replaced', async () => {
        // A rule for a whole domain reaches a new subdomain too, but the baked
        // conditions map has no entry for it, so the generation must be
        // invalidated even though the rules did not change. The replaced case
        // keeps the number of facts: only the host tag separates it.
        const content = '@@||youtube.com^$generichide';
        const apex = await fingerprint(content, ['youtube.com']);
        const wider = await fingerprint(content, ['music.youtube.com', 'youtube.com']);
        const replaced = await fingerprint(content, ['music.youtube.com']);

        expect(wider).not.toBe(apex);
        expect(replaced).not.toBe(apex);
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

    it('counts an exception only once its hostname is covered', async () => {
        const base = await fingerprint('@@||youtube.com^$document');
        const covered = await fingerprint('@@||youtube.com^$document', [...HOSTS, 'example.org']);
        const withOtherSite = await fingerprint(
            ['@@||youtube.com^$document', '@@||example.org^$generichide'].join('\n'),
            [...HOSTS, 'example.org'],
        );

        // The scope itself is not hashed, only the facts it keeps: the rule
        // does not reach `example.org`, so the extra host adds no fact.
        expect(covered).toBe(base);
        expect(withOtherSite).not.toBe(base);
    });

    it('ignores an exception added for a host outside the covered set', async () => {
        // Between two resource updates filter 2 can gain exceptions for other
        // sites only; that must not invalidate the baked generation.
        const base = await fingerprint('@@||youtube.com^$document');
        const updated = await fingerprint([
            '@@||youtube.com^$document',
            '@@||balkantelevizija.net^$generichide',
            '@@||ewybory.eu^$generichide',
        ].join('\n'));

        expect(updated).toBe(base);
    });

    it('ignores an unanchored rule the `$domain` keeps away from the host', async () => {
        // The pattern can occur inside a URL of any host, so only the modifier
        // decides: an edit for other sites must not invalidate the generation.
        const base = await fingerprint('@@||youtube.com^$document');

        const foreign = await fingerprint([
            '@@||youtube.com^$document',
            '@@*$generichide,domain=cuttlinks.com|exe-links.com',
        ].join('\n'));
        expect(foreign).toBe(base);

        const reaching = await fingerprint([
            '@@||youtube.com^$document',
            '@@*$generichide,domain=cuttlinks.com|youtube.com',
        ].join('\n'));
        expect(reaching).not.toBe(base);
    });

    it('checks the third-party flag against the page request', async () => {
        // The page is its own source, so only `~third-party` can apply to it.
        const base = await fingerprint('@@||youtube.com^$document');

        const thirdParty = await fingerprint([
            '@@||youtube.com^$document',
            '@@*$generichide,third-party',
        ].join('\n'));
        expect(thirdParty).toBe(base);

        const firstParty = await fingerprint([
            '@@||youtube.com^$document',
            '@@*$generichide,~third-party',
        ].join('\n'));
        expect(firstParty).not.toBe(base);
    });

    it('changes when a `$domain` value narrows the rule', async () => {
        // The pattern stays `*`, only the domain moves: the engine's verdict
        // on youtube.com changes, so the hash must change too.
        expect(await fingerprint('@@*$jsinject,domain=youtube.com'))
            .not.toBe(await fingerprint('@@*$jsinject,domain=music.youtube.com'));
    });
});
