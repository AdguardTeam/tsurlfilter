import { describe, expect, it } from 'vitest';

import {
    computePageExceptionsFingerprint,
    type PreregisteredFilterList,
} from '../../../../../src/lib/mv3/background/preregistered-scripts/exception-fingerprint';

/**
 * Wraps one filter list.
 *
 * @param content Filter list content.
 * @param filterId Filter id.
 *
 * @returns Lists argument of the fingerprint.
 */
const list = (content: string, filterId = 2): PreregisteredFilterList[] => [{ filterId, content }];

describe('computePageExceptionsFingerprint', () => {
    it('is stable for the same rules and does not depend on the line order', async () => {
        const first = await computePageExceptionsFingerprint(list([
            '@@||youtube.com/my_video_ad$document',
            '@@||youtube.com^$generichide',
        ].join('\n')));
        const second = await computePageExceptionsFingerprint(list([
            '@@||youtube.com^$generichide',
            '@@||youtube.com/my_video_ad$document',
        ].join('\n')));

        expect(first).toEqual(second);
    });

    it('changes when an exception is added or removed', async () => {
        const base = await computePageExceptionsFingerprint(list('@@||youtube.com^$jsinject'));
        const added = await computePageExceptionsFingerprint(list([
            '@@||youtube.com^$jsinject',
            '@@||youtube.com/embed/$jsinject',
        ].join('\n')));
        const removed = await computePageExceptionsFingerprint(list(''));

        expect(new Set([base['2'], added['2'], removed['2']]).size).toBe(3);
    });

    it('keeps one entry per filter, so a disabled filter does not invalidate the others', async () => {
        const both = await computePageExceptionsFingerprint([
            { filterId: 2, content: '@@||youtube.com^$document' },
            { filterId: 3, content: '@@||youtube.com^$generichide' },
        ]);
        const onlyFilterTwo = await computePageExceptionsFingerprint([
            { filterId: 2, content: '@@||youtube.com^$document' },
        ]);

        // The enabled filters are compared one by one: an entry missing from
        // the runtime map is simply not compared.
        expect(onlyFilterTwo['2']).toBe(both['2']);
        expect(both['3']).toBeDefined();
    });

    it('ignores rules the page gate does not depend on', async () => {
        const base = await computePageExceptionsFingerprint(list('@@||youtube.com^$jsinject'));
        const withNoise = await computePageExceptionsFingerprint(list([
            '@@||youtube.com^$jsinject',
            '||ads.example.com^',
            '@@||youtube.com^$script',
        ].join('\n')));

        expect(withNoise).toEqual(base);
    });

    it('gives an empty list the same fingerprint as a list without exceptions', async () => {
        const empty = await computePageExceptionsFingerprint(list(''));
        const noise = await computePageExceptionsFingerprint(list('||ads.example.com^'));

        expect(empty['2']).toBe(noise['2']);
    });
});
