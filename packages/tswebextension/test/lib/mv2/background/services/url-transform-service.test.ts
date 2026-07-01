import {
    beforeEach,
    describe,
    expect,
    it,
} from 'vitest';

import { HTTPMethod, MatchingResult, RequestType } from '@adguard/tsurlfilter';

import { FilteringEventType } from '../../../../../src/lib/common/filtering-log';
import { ContentType } from '../../../../../src/lib/common/request-type';
import {
    RequestContextState,
    requestContextStorage,
} from '../../../../../src/lib/mv2/background/request/request-context-storage';
import { UrlTransformService } from '../../../../../src/lib/mv2/background/services/url-transform-service';
import { mockEngineApi } from '../../../../helpers/mocks';
import { createNetworkRule } from '../../../../helpers/rule-creator';
import { MockFilteringLog } from '../../../common/mocks/mock-filtering-log';

describe('UrlTransformService', () => {
    const mockFilteringLog = new MockFilteringLog();
    const urlTransformService = new UrlTransformService(mockFilteringLog, mockEngineApi);

    beforeEach(() => {
        mockFilteringLog.publishEvent.mockClear();
        requestContextStorage.clear();
    });

    /**
     * Helper to set up a request context with the given URL and urltransform rules.
     *
     * @param url Request URL.
     * @param rulesText Array of rule text strings.
     *
     * @returns The request id used to store the context.
     */
    const setupContext = (
        url: string,
        rulesText: string[],
    ): string => {
        const requestId = '12345';

        requestContextStorage.set(requestId, {
            eventId: '1',
            state: RequestContextState.BeforeRequest,
            requestId,
            requestUrl: url,
            referrerUrl: url,
            method: HTTPMethod.GET,
            requestType: RequestType.Document,
            tabId: 0,
            frameId: 0,
            requestFrameId: 0,
            timestamp: Date.now(),
            thirdParty: false,
            matchingResult: new MatchingResult(
                rulesText.map((ruleText) => createNetworkRule(ruleText, 1)),
                null,
            ),
            contentType: ContentType.Document,
        });

        return requestId;
    };

    it('returns null url if request context does not exist', () => {
        const result = urlTransformService.getTransformedUrl('nonexistent');
        expect(result.url).toBe(null);
        expect(result.isOriginChanged).toBe(false);
    });

    it('returns null url if no urltransform rules match', () => {
        const requestId = setupContext('https://example.org/page', []);
        const result = urlTransformService.getTransformedUrl(requestId);
        expect(result.url).toBe(null);
    });

    it('transforms URL with a basic path rewrite', () => {
        const requestId = setupContext(
            'https://example.org/old/page',
            ['||example.org^$urltransform=/\\/old\\//\\/new\\//'],
        );

        const result = urlTransformService.getTransformedUrl(requestId);
        expect(result.url).toBe('https://example.org/new/page');
        expect(result.isOriginChanged).toBe(false);
        expect(mockFilteringLog.publishEvent).toHaveBeenCalledWith(
            expect.objectContaining({ type: FilteringEventType.UrlTransform }),
        );
    });

    it('returns null url when transform does not change URL', () => {
        const requestId = setupContext(
            'https://example.org/page',
            ['||example.org^$urltransform=/\\/nomatch\\//\\/new\\//'],
        );

        const result = urlTransformService.getTransformedUrl(requestId);
        expect(result.url).toBe(null);
        expect(mockFilteringLog.publishEvent).not.toHaveBeenCalled();
    });

    it('applies multiple rules sorted alphabetically', () => {
        const requestId = setupContext(
            'https://example.org/AX',
            [
                '||example.org^$urltransform=/X/Y/',
                '||example.org^$urltransform=/A/B/',
            ],
        );

        const result = urlTransformService.getTransformedUrl(requestId);
        // Sorted alphabetically: /A/B/ first (AX -> BX), then /X/Y/ (BX -> BY)
        expect(result.url).toBe('https://example.org/BY');
        expect(mockFilteringLog.publishEvent).toHaveBeenCalledTimes(2);
    });

    it('handles full-URL mode transform and detects origin change', () => {
        const requestId = setupContext(
            'https://old.example.com/path',
            ['||old.example.com^$urltransform=/^https:\\/\\/old\\.example\\.com(.*)/https:\\/\\/new.example.net\\$1/'],
        );

        const result = urlTransformService.getTransformedUrl(requestId);
        expect(result.url).toBe('https://new.example.net/path');
        expect(result.isOriginChanged).toBe(true);
        expect(mockFilteringLog.publishEvent).toHaveBeenCalledWith(
            expect.objectContaining({ type: FilteringEventType.UrlTransform }),
        );
    });

    it('logs allowlist rules but does not modify URL', () => {
        const requestId = setupContext(
            'https://example.org/old/page',
            [
                '||example.org^$urltransform=/\\/old\\//\\/new\\//',
                '@@||example.org^$urltransform=/\\/old\\//\\/new\\//',
            ],
        );

        const result = urlTransformService.getTransformedUrl(requestId);
        // Allowlist cancels the transform rule
        expect(result.url).toBe(null);
    });

    it('returns null url when matchingResult is null', () => {
        const requestId = '12345';

        requestContextStorage.set(requestId, {
            eventId: '1',
            state: RequestContextState.BeforeRequest,
            requestId,
            requestUrl: 'https://example.org/',
            referrerUrl: 'https://example.org/',
            method: HTTPMethod.GET,
            requestType: RequestType.Document,
            tabId: 0,
            frameId: 0,
            requestFrameId: 0,
            timestamp: Date.now(),
            thirdParty: false,
            matchingResult: null,
            contentType: ContentType.Document,
        });

        const result = urlTransformService.getTransformedUrl(requestId);
        expect(result.url).toBe(null);
    });
});
