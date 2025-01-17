import { describe, expect, it } from 'vitest';
import { type MatchingResult, type CosmeticResult } from '@adguard/tsurlfilter';

import { Frame } from '../../../../../src/lib';

describe('Frame', () => {
    describe('constructor', () => {
        it('should create a new Frame instance with the correct properties', () => {
            const url = 'https://example.com';
            const requestId = '123';
            const cosmeticResult = {} as CosmeticResult;
            const matchingResult = {} as MatchingResult;

            const frame = new Frame(url, requestId);
            frame.cosmeticResult = cosmeticResult;
            frame.matchingResult = matchingResult;

            expect(frame).toBeInstanceOf(Frame);
            expect(frame.url).toBe(url);
            expect(frame.requestId).toBe(requestId);
            expect(frame.cosmeticResult).toBe(cosmeticResult);
            expect(frame.matchingResult).toBe(matchingResult);
        });
    });
});
