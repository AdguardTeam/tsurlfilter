import { MatchingResult, NetworkRule, RequestType } from '@adguard/tsurlfilter';

import { ParamsService } from '@lib/mv2/background/services/params-service';
import { RequestContextState, requestContextStorage } from '@lib/mv2/background/request';

import { MockFilteringLog } from '../../../common/mock-filtering-log';

describe('Params service', () => {
    const mockFilteringLog = new MockFilteringLog();
    const paramsService = new ParamsService(mockFilteringLog);

    beforeEach(() => {
        mockFilteringLog.addRemoveHeaderEvent.mockClear();
        requestContextStorage.clear();
    });

    const testUrlPurge = (
        url: string,
        method: string,
        requestType: RequestType,
        rulesText: string[],
    ) => {
        const requestId = '12345';

        requestContextStorage.record(requestId, {
            state: RequestContextState.BEFORE_REQUEST,
            requestId,
            requestUrl: url,
            referrerUrl: url,
            method,
            requestType,
            tabId: 0,
            frameId: 0,
            requestFrameId: 0,
            timestamp: Date.now(),
            thirdParty: false,
            matchingResult: new MatchingResult(rulesText.map(((ruleText) => new NetworkRule(ruleText, 1))), null),
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
            RequestType.Document,
            [],
        );

        expect(purgedUrl).toBe(null);
    });

    it('removes get request params', () => {
        const purgedUrl = testUrlPurge(
            'https://example.org?param=1',
            'GET',
            RequestType.Document,
            ['||example.org^$removeparam'],
        );

        expect(purgedUrl).toBe('https://example.org');
        expect(mockFilteringLog.addRemoveParamEvent).toHaveBeenCalled();
    });

    it('ignores post request params', () => {
        const purgedUrl = testUrlPurge(
            'https://example.org?param=1',
            'POST',
            RequestType.Document,
            ['||example.org^$removeparam'],
        );

        expect(purgedUrl).toBe(null);
    });

    it('correctly proccess allowlist rule', () => {
        const purgedUrl = testUrlPurge(
            'https://example.org?param=1',
            'POST',
            RequestType.Document,
            ['@@||example.org^$removeparam'],
        );

        expect(purgedUrl).toBe(null);
    });

    it('removes only specific param', () => {
        const purgedUrl = testUrlPurge(
            'https://example.org?param=1&test=1',
            'GET',
            RequestType.Document,
            ['||example.org^$removeparam=param'],
        );

        expect(purgedUrl).toBe('https://example.org?test=1');
        expect(mockFilteringLog.addRemoveParamEvent).toHaveBeenCalled();
    });

    it('doesn`t remove unspecific param', () => {
        const purgedUrl = testUrlPurge(
            'https://example.org?test=1',
            'GET',
            RequestType.Document,
            ['||example.org^$removeparam=param'],
        );

        expect(purgedUrl).toBe(null);
        expect(mockFilteringLog.addRemoveParamEvent).toHaveBeenCalled();
    });
});
