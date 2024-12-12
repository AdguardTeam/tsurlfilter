import { describe, expect, it } from 'vitest';
import type { MatchingResult, CosmeticResult } from '@adguard/tsurlfilter';

import { Frame } from '../../../../src/lib/mv3/tabs/frame';

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

            const frame = new Frame({
                url,
                tabId,
                frameId,
                timeStamp,
                parentDocumentId,
            });
            frame.cosmeticResult = cosmeticResult;
            frame.matchingResult = matchingResult;

            expect(frame).toBeInstanceOf(Frame);
            expect(frame.url).toBe(url);
            expect(frame.frameId).toBe(frameId);
            expect(frame.tabId).toBe(tabId);
            expect(frame.cosmeticResult).toBe(cosmeticResult);
            expect(frame.matchingResult).toBe(matchingResult);
        });
    });
});
