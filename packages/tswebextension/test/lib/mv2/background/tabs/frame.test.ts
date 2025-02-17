import { describe, expect, it } from 'vitest';
import { type MatchingResult, type CosmeticResult } from '@adguard/tsurlfilter';

import { MAIN_FRAME_ID, NO_PARENT_FRAME_ID } from '../../../../../src/lib/common/constants';
import { FrameMV2 } from '../../../../../src/lib/mv2/background/tabs/frame';

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
});
