import {
    afterEach,
    describe,
    expect,
    it,
} from 'vitest';

import { appContext } from '../../../../../src/lib/mv3/background/app-context';
import { getCoveredRules } from '../../../../../src/lib/mv3/background/preregistered-scripts/coverage';
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

describe('getCoveredRules', () => {
    afterEach(() => {
        appContext.preregisteredScriptRules = undefined;
        appContext.preregisteredScriptRulesAtBoot = undefined;
    });

    it('returns the covered hashes of the main frame host', () => {
        appContext.preregisteredScriptRules = new Map([['youtube.com', new Set(['abc'])]]);

        expect(getCoveredRules(frame(0, 'https://YouTube.com/watch')))
            .toEqual(new Set(['abc']));
    });

    it('uses the boot snapshot for a pre-existing document', () => {
        appContext.preregisteredScriptRules = new Map([['youtube.com', new Set(['current'])]]);
        appContext.preregisteredScriptRulesAtBoot = new Map([['youtube.com', new Set(['boot'])]]);

        expect(getCoveredRules(frame(0, 'https://youtube.com/'), true))
            .toEqual(new Set(['boot']));
    });

    it('returns undefined for any subframe, so the engine decides there', () => {
        // The frame's verdict depends on the parent's rules, which the page
        // cannot read: frames always keep the dynamic path.
        appContext.preregisteredScriptRules = new Map([['youtube.com', new Set(['abc'])]]);

        expect(getCoveredRules(frame(2, 'https://youtube.com/embed', 0))).toBeUndefined();
    });

    it('returns undefined for a non-http main frame', () => {
        appContext.preregisteredScriptRules = new Map([['youtube.com', new Set(['abc'])]]);

        expect(getCoveredRules(frame(0, 'about:blank'))).toBeUndefined();
    });

    it('returns undefined for a host without coverage', () => {
        appContext.preregisteredScriptRules = new Map([['youtube.com', new Set(['abc'])]]);

        expect(getCoveredRules(frame(0, 'https://example.com/'))).toBeUndefined();
    });

    it('returns undefined when there is no coverage at all', () => {
        appContext.preregisteredScriptRules = new Map();

        expect(getCoveredRules(frame(0, 'https://youtube.com/'))).toBeUndefined();
    });
});
