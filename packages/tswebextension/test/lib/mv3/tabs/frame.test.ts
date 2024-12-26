import { describe, expect, it } from 'vitest';
import { type MatchingResult, type CosmeticResult } from '@adguard/tsurlfilter';

import { FrameMV3 } from '../../../../src/lib/mv3/tabs/frame';

describe('Frame', () => {
    describe('constructor', () => {
        it('should create a new Frame instance with the correct properties', () => {
            const url = 'https://example.com';
            const cosmeticResult = {} as CosmeticResult;
            const matchingResult = {} as MatchingResult;
            const tabId = 1;
            const frameId = 0;
            const timeStamp = Date.now();
            const parentDocumentId = '1';

            const frame = new FrameMV3({
                url,
                tabId,
                frameId,
                timeStamp,
                parentDocumentId,
            });
            frame.cosmeticResult = cosmeticResult;
            frame.matchingResult = matchingResult;

            expect(frame).toBeInstanceOf(FrameMV3);
            expect(frame.url).toBe(url);
            expect(frame.frameId).toBe(frameId);
            expect(frame.tabId).toBe(tabId);
            expect(frame.cosmeticResult).toBe(cosmeticResult);
            expect(frame.matchingResult).toBe(matchingResult);
        });
    });
});
