import { describe, expect, it } from 'vitest';

import { type CosmeticResult, type MatchingResult } from '@adguard/tsurlfilter';

import { MAIN_FRAME_ID, NO_PARENT_FRAME_ID } from '../../../../../src/lib/common/constants';
import { FrameMV2, type PreparedCosmeticResultMV2 } from '../../../../../src/lib/mv2/background/tabs/frame';

/**
 * Creates a frame with the default test values.
 *
 * @returns A new {@link FrameMV2} instance.
 */
const createFrame = (): FrameMV2 => new FrameMV2({
    url: 'https://example.com',
    tabId: 1,
    frameId: MAIN_FRAME_ID,
    parentFrameId: NO_PARENT_FRAME_ID,
    timeStamp: Date.now(),
    parentDocumentId: '1',
});

describe('Frame', () => {
    describe('constructor', () => {
        it('should create a new Frame instance with the correct properties', () => {
            const url = 'https://example.com';
            const cosmeticResult = {} as CosmeticResult;
            const matchingResult = {} as MatchingResult;
            const tabId = 1;
            const frameId = MAIN_FRAME_ID;
            const parentFrameId = NO_PARENT_FRAME_ID;
            const timeStamp = Date.now();
            const parentDocumentId = '1';

            const frame = new FrameMV2({
                url,
                tabId,
                frameId,
                parentFrameId,
                timeStamp,
                parentDocumentId,
            });
            frame.cosmeticResult = cosmeticResult;
            frame.matchingResult = matchingResult;

            expect(frame).toBeInstanceOf(FrameMV2);
            expect(frame.url).toBe(url);
            expect(frame.frameId).toBe(frameId);
            expect(frame.parentFrameId).toBe(parentFrameId);
            expect(frame.tabId).toBe(tabId);
            expect(frame.cosmeticResult).toBe(cosmeticResult);
            expect(frame.matchingResult).toBe(matchingResult);
        });
    });

    describe('extCssApplied', () => {
        it('defaults extCssApplied to false', () => {
            expect(createFrame().extCssApplied).toBe(false);
        });
    });

    describe('preparedCosmeticResult', () => {
        it('stores prepared ExtCSS rules and the hits flag', () => {
            const extCssRules = ['.ad:has(.child) { display: none !important; }'];
            const preparedCosmeticResult: PreparedCosmeticResultMV2 = {
                scriptText: '',
                extCssRules,
                areHitsStatsCollected: true,
            };

            const frame = createFrame();
            frame.preparedCosmeticResult = preparedCosmeticResult;

            expect(frame.preparedCosmeticResult.extCssRules).toEqual(extCssRules);
            expect(frame.preparedCosmeticResult.areHitsStatsCollected).toBe(true);
        });
    });
});
