import {
    afterEach,
    describe,
    expect,
    it,
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

    it('returns the lower-cased host of an http frame', async () => {
        await expect(resolveCoverageHost(
            1,
            frame(0, 'https://YouTube.com/watch'),
            () => undefined,
            HOSTS,
        )).resolves.toBe('youtube.com');
    });

    it('walks up to the nearest http ancestor of an opaque frame', async () => {
        const parent = frame(0, 'https://youtube.com/');

        await expect(resolveCoverageHost(1, frame(2, 'about:blank', 0), () => parent, HOSTS))
            .resolves.toBe('youtube.com');
    });

    it('returns null when the chain has no http ancestor', async () => {
        await expect(resolveCoverageHost(1, frame(2, 'about:blank', 0), () => undefined, HOSTS))
            .resolves.toBeNull();
    });

    it('returns null when the top-level host is not preregistered', async () => {
        const top = frame(0, 'https://example.com/');

        await expect(resolveCoverageHost(
            1,
            frame(2, 'https://youtube.com/embed', 0),
            () => top,
            HOSTS,
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
        )).resolves.toBe('youtube.com');
    });

    it('returns null for an opaque top-level origin', async () => {
        const top = frame(0, 'data:text/html,<iframe></iframe>');

        await expect(resolveCoverageHost(
            1,
            frame(2, 'https://youtube.com/embed', 0),
            () => top,
            HOSTS,
        )).resolves.toBeNull();
    });

    it('resolves a pruned parent from the live frame tree', async () => {
        const liveTop = frame(0, 'https://youtube.com/watch');

        await expect(resolveCoverageHost(
            1,
            frame(2, 'https://youtube.com/embed', 0),
            () => undefined,
            HOSTS,
            async () => new Map([[0, liveTop]]),
        )).resolves.toBe('youtube.com');
    });

    it('returns null when the pruned parent is missing from the live tree', async () => {
        await expect(resolveCoverageHost(
            1,
            frame(2, 'https://youtube.com/embed', 0),
            () => undefined,
            HOSTS,
            async () => new Map(),
        )).resolves.toBeNull();
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
