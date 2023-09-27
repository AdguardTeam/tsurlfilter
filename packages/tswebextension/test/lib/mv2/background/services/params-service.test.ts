import { MatchingResult, NetworkRule, RequestType } from '@adguard/tsurlfilter';

import { ParamsService } from '@lib/mv2/background/services/params-service';
import { RequestContextState, requestContextStorage } from '@lib/mv2/background/request';
import { ContentType, FilteringEventType } from '@lib/common';

import { MockFilteringLog } from '../../../common/mocks/mock-filtering-log';

describe('Params service', () => {
    const mockFilteringLog = new MockFilteringLog();
    const paramsService = new ParamsService(mockFilteringLog);

    beforeEach(() => {
        mockFilteringLog.publishEvent.mockClear();
        requestContextStorage.clear();
    });

    const testUrlPurge = (
        url: string,
        method: string,
        rulesText: string[],
    ): string | null => {
        const requestId = '12345';

        requestContextStorage.set(requestId, {
            state: RequestContextState.BeforeRequest,
            requestId,
            requestUrl: url,
            referrerUrl: url,
            method,
            requestType: RequestType.Document,
            tabId: 0,
            frameId: 0,
            requestFrameId: 0,
            timestamp: Date.now(),
            thirdParty: false,
            matchingResult: new MatchingResult(rulesText.map(((ruleText) => new NetworkRule(ruleText, 1))), null),
            contentType: ContentType.Document,
        });

        return paramsService.getPurgedUrl(requestId);
    };

    it('returns null if request context is not exist', () => {
        const purgedUrl = paramsService.getPurgedUrl('12345');

        expect(purgedUrl).toBe(null);
    });

    it('returns null if removeparam rules is not exist', () => {
        const purgedUrl = testUrlPurge(
            'https://example.org?param=1',
            'GET',
            [],
        );

        expect(purgedUrl).toBe(null);
    });

    it('removes GET request params', () => {
        const purgedUrl = testUrlPurge(
            'https://example.org?param=1',
            'GET',
            ['||example.org^$removeparam'],
        );

        expect(purgedUrl).toBe('https://example.org');
        expect(mockFilteringLog.publishEvent).toHaveBeenCalledWith(
            expect.objectContaining({ type: FilteringEventType.RemoveParam }),
        );
    });

    it('removes POST request params', () => {
        const purgedUrl = testUrlPurge(
            'https://example.org?param=1',
            'POST',
            ['||example.org^$removeparam'],
        );

        expect(purgedUrl).toBe('https://example.org');
        expect(mockFilteringLog.publishEvent).toHaveBeenCalledWith(
            expect.objectContaining({ type: FilteringEventType.RemoveParam }),
        );
    });

    it('correctly processes allowlist rule', () => {
        const purgedUrl = testUrlPurge(
            'https://example.org?param=1',
            'GET',
            ['||example.org^$removeparam=param', '@@||example.org^$removeparam=param'],
        );

        expect(purgedUrl).toBe(null);
        expect(mockFilteringLog.publishEvent).toHaveBeenCalledWith(
            expect.objectContaining({ type: FilteringEventType.RemoveParam }),
        );
    });

    it('removes only specific param', () => {
        const purgedUrl = testUrlPurge(
            'https://example.org?param=1&test=1',
            'GET',
            ['||example.org^$removeparam=param'],
        );

        expect(purgedUrl).toBe('https://example.org?test=1');
        expect(mockFilteringLog.publishEvent).toHaveBeenCalledWith(
            expect.objectContaining({ type: FilteringEventType.RemoveParam }),
        );
    });

    it('doesn\'t remove unspecific param', () => {
        const purgedUrl = testUrlPurge(
            'https://example.org?test=1',
            'GET',
            ['||example.org^$removeparam=param'],
        );

        expect(purgedUrl).toBe(null);
        expect(mockFilteringLog.publishEvent).not.toHaveBeenCalledWith(
            expect.objectContaining({ type: FilteringEventType.RemoveParam }),
        );
    });
});
