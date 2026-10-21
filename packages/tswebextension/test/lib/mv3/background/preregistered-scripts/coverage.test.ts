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
    it('returns the lower-cased host of an http frame', () => {
        expect(resolveCoverageHost(1, frame(0, 'https://YouTube.com/watch'), () => undefined))
            .toBe('youtube.com');
    });

    it('walks up to the nearest http ancestor of an opaque frame', () => {
        const parent = frame(0, 'https://youtube.com/');

        expect(resolveCoverageHost(1, frame(2, 'about:blank', 0), () => parent))
            .toBe('youtube.com');
    });

    it('returns null when the chain has no http ancestor', () => {
        expect(resolveCoverageHost(1, frame(2, 'about:blank', 0), () => undefined))
            .toBeNull();
    });
});

describe('getCoveredRules', () => {
    afterEach(() => {
        appContext.preregisteredScriptRules = undefined;
        appContext.preregisteredScriptRulesAtBoot = undefined;
    });

    it('returns the covered hashes for the resolved host', () => {
        appContext.preregisteredScriptRules = new Map([['youtube.com', new Set(['abc'])]]);

        expect(getCoveredRules(1, frame(0, 'https://youtube.com/'), () => undefined))
            .toEqual(new Set(['abc']));
    });

    it('uses the boot snapshot for a pre-existing document', () => {
        appContext.preregisteredScriptRules = new Map([['youtube.com', new Set(['current'])]]);
        appContext.preregisteredScriptRulesAtBoot = new Map([['youtube.com', new Set(['boot'])]]);

        expect(getCoveredRules(1, frame(0, 'https://youtube.com/'), () => undefined, true))
            .toEqual(new Set(['boot']));
    });

    it('returns undefined when there is no coverage', () => {
        appContext.preregisteredScriptRules = new Map();

        expect(getCoveredRules(1, frame(0, 'https://youtube.com/'), () => undefined))
            .toBeUndefined();
    });
});
