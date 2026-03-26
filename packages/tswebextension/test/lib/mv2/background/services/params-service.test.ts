import {
    describe,
    expect,
    beforeEach,
    it,
} from 'vitest';
import { HTTPMethod, MatchingResult, RequestType } from '@adguard/tsurlfilter';

import { createNetworkRule } from '../../../../helpers/rule-creator';
import { MockFilteringLog } from '../../../common/mocks/mock-filtering-log';
import { mockEngineApi } from '../../../../helpers/mocks';
import { ParamsService } from '../../../../../src/lib/mv2/background/services/params-service';
import {
    RequestContextState,
    requestContextStorage,
} from '../../../../../src/lib/mv2/background/request/request-context-storage';
import { ContentType } from '../../../../../src/lib/common/request-type';
import { FilteringEventType } from '../../../../../src/lib/common/filtering-log';

describe('Params service', () => {
    const mockFilteringLog = new MockFilteringLog();
    const paramsService = new ParamsService(mockFilteringLog, mockEngineApi);

    beforeEach(() => {
        mockFilteringLog.publishEvent.mockClear();
        requestContextStorage.clear();
    });

    const testUrlPurge = (
        url: string,
        method: HTTPMethod,
        rulesText: string[],
    ): string | null => {
        const requestId = '12345';

        requestContextStorage.set(requestId, {
            eventId: '1',
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
            matchingResult: new MatchingResult(rulesText.map(((ruleText) => createNetworkRule(ruleText, 1))), null),
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
            HTTPMethod.GET,
            [],
        );

        expect(purgedUrl).toBe(null);
    });

    it('removes GET request params', () => {
        const purgedUrl = testUrlPurge(
            'https://example.org?param=1',
            HTTPMethod.GET,
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
            HTTPMethod.POST,
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
            HTTPMethod.GET,
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
            HTTPMethod.GET,
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
            HTTPMethod.GET,
            ['||example.org^$removeparam=param'],
        );

        expect(purgedUrl).toBe(null);
        expect(mockFilteringLog.publishEvent).not.toHaveBeenCalledWith(
            expect.objectContaining({ type: FilteringEventType.RemoveParam }),
        );
    });
});
