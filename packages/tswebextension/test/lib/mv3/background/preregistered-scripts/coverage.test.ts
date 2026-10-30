import {
    afterEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import { appContext } from '../../../../../src/lib/mv3/background/app-context';
import {
    getCoveredRules,
    resolveCoverageHost,
} from '../../../../../src/lib/mv3/background/preregistered-scripts/coverage';
import { type FrameMV3 } from '../../../../../src/lib/mv3/tabs/frame';

/**
 * Builds a minimal frame context for the coverage lookups.
 *
 * @param frameId Frame id.
 * @param url Frame URL.
 * @param parentFrameId Parent frame id.
 *
 * @returns Frame context stub.
 */
const frame = (frameId: number, url: string, parentFrameId = -1): FrameMV3 => ({
    frameId,
    url,
    parentFrameId,
} as unknown as FrameMV3);

describe('resolveCoverageHost', () => {
    const HOSTS = new Set(['youtube.com', 'www.youtube.com']);

    /**
     * Treats every host as covered; the early exit is tested separately.
     *
     * @returns Always true.
     */
    const COVERED = (): boolean => true;

    it('returns the lower-cased host of an http frame', async () => {
        await expect(resolveCoverageHost(
            1,
            frame(0, 'https://YouTube.com/watch'),
            () => undefined,
            HOSTS,
            COVERED,
        )).resolves.toBe('youtube.com');
    });

    it('walks up to the nearest http ancestor of an opaque frame', async () => {
        const parent = frame(0, 'https://youtube.com/');

        await expect(resolveCoverageHost(1, frame(2, 'about:blank', 0), () => parent, HOSTS, COVERED))
            .resolves.toBe('youtube.com');
    });

    it('returns null when the chain has no http ancestor', async () => {
        await expect(resolveCoverageHost(1, frame(2, 'about:blank', 0), () => undefined, HOSTS, COVERED))
            .resolves.toBeNull();
    });

    it('returns null when the top-level host is not preregistered', async () => {
        const top = frame(0, 'https://example.com/');

        await expect(resolveCoverageHost(
            1,
            frame(2, 'https://youtube.com/embed', 0),
            () => top,
            HOSTS,
            COVERED,
        )).resolves.toBeNull();
    });

    it('keeps coverage when a foreign frame sits under a preregistered top', async () => {
        // The filtering state is tab-level: an intermediate frame does not
        // change it, and the dynamic path does not consider it.
        const middle = frame(1, 'https://example.com/embed', 0);
        const top = frame(0, 'https://youtube.com/watch');

        await expect(resolveCoverageHost(
            1,
            frame(2, 'https://youtube.com/embed', 1),
            (_tabId, id) => (id === 1 ? middle : top),
            HOSTS,
            COVERED,
        )).resolves.toBe('youtube.com');
    });

    it('returns null for an opaque top-level origin', async () => {
        const top = frame(0, 'data:text/html,<iframe></iframe>');

        await expect(resolveCoverageHost(
            1,
            frame(2, 'https://youtube.com/embed', 0),
            () => top,
            HOSTS,
            COVERED,
        )).resolves.toBeNull();
    });

    it('resolves a pruned parent from the live frame tree', async () => {
        const liveTop = frame(0, 'https://youtube.com/watch');

        await expect(resolveCoverageHost(
            1,
            frame(2, 'https://youtube.com/embed', 0),
            () => undefined,
            HOSTS,
            COVERED,
            async () => new Map([[0, liveTop]]),
        )).resolves.toBe('youtube.com');
    });

    it('returns null when the pruned parent is missing from the live tree', async () => {
        await expect(resolveCoverageHost(
            1,
            frame(2, 'https://youtube.com/embed', 0),
            () => undefined,
            HOSTS,
            COVERED,
            async () => new Map(),
        )).resolves.toBeNull();
    });

    it('does not trust a cached top frame left over from navigation start', async () => {
        // The top frame context is rewritten at navigation start, before the
        // commit, and that write carries no document id. A navigation that
        // never commits leaves the foreign URL on the cached top while the old
        // page stays, and the child still points at the old document.
        const staleTop = frame(0, 'https://example.com/');
        const liveTop = { ...frame(0, 'https://youtube.com/watch'), documentId: 'old-document' };

        await expect(resolveCoverageHost(
            1,
            { ...frame(2, 'https://youtube.com/embed', 0), parentDocumentId: 'old-document' },
            () => staleTop,
            HOSTS,
            COVERED,
            async () => new Map([[0, liveTop]]),
        )).resolves.toBe('youtube.com');
    });

    it('trusts a cached top frame that belongs to the same document', async () => {
        const top = { ...frame(0, 'https://youtube.com/watch'), documentId: 'doc-1' };
        const getFrameTree = vi.fn(async () => new Map([[0, frame(0, 'https://example.com/')]]));

        await expect(resolveCoverageHost(
            1,
            { ...frame(2, 'https://youtube.com/embed', 0), parentDocumentId: 'doc-1' },
            () => top,
            HOSTS,
            COVERED,
            getFrameTree,
        )).resolves.toBe('youtube.com');

        expect(getFrameTree).not.toHaveBeenCalled();
    });

    it('stops before the top frame when the nearest host has no coverage', async () => {
        // Nothing is registered for `example.com`, so the top-level origin
        // cannot make the frame covered: the walk must not pay for the frame
        // tree round trip.
        const getFrameTree = vi.fn(async () => new Map());

        await expect(resolveCoverageHost(
            1,
            frame(2, 'https://example.com/ad', 0),
            () => undefined,
            HOSTS,
            () => false,
            getFrameTree,
        )).resolves.toBeNull();

        expect(getFrameTree).not.toHaveBeenCalled();
    });
});

describe('getCoveredRules', () => {
    afterEach(() => {
        appContext.preregisteredScriptRules = undefined;
        appContext.preregisteredScriptRulesAtBoot = undefined;
        appContext.preregisteredHostnames = undefined;
    });

    it('returns the covered hashes for the resolved host', async () => {
        appContext.preregisteredScriptRules = new Map([['youtube.com', new Set(['abc'])]]);
        appContext.preregisteredHostnames = new Set(['youtube.com']);

        await expect(getCoveredRules(1, frame(0, 'https://youtube.com/'), () => undefined))
            .resolves.toEqual(new Set(['abc']));
    });

    it('uses the boot snapshot for a pre-existing document', async () => {
        appContext.preregisteredScriptRules = new Map([['youtube.com', new Set(['current'])]]);
        appContext.preregisteredScriptRulesAtBoot = new Map([['youtube.com', new Set(['boot'])]]);
        appContext.preregisteredHostnames = new Set(['youtube.com']);

        await expect(getCoveredRules(1, frame(0, 'https://youtube.com/'), () => undefined, true))
            .resolves.toEqual(new Set(['boot']));
    });

    it('returns undefined when there is no coverage', async () => {
        appContext.preregisteredScriptRules = new Map();

        await expect(getCoveredRules(1, frame(0, 'https://youtube.com/'), () => undefined))
            .resolves.toBeUndefined();
    });

    it('returns undefined when the host set is not published', async () => {
        appContext.preregisteredScriptRules = new Map([['youtube.com', new Set(['abc'])]]);

        await expect(getCoveredRules(1, frame(0, 'https://youtube.com/'), () => undefined))
            .resolves.toBeUndefined();
    });
});
