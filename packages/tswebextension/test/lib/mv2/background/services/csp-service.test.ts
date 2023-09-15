import { CspService } from '@lib/mv2/background/services/csp-service';
import { MatchingResult, NetworkRule, RequestType } from '@adguard/tsurlfilter';
import { ContentType, FilteringEventType } from '@lib/common';
import { RequestContext } from '@lib/mv2/background/request';
import { MockFilteringLog } from '../../../common/mocks/mock-filtering-log';

describe('Csp service', () => {
    const mockFilteringLog = new MockFilteringLog();
    const cspService = new CspService(mockFilteringLog);

    let context: RequestContext;

    beforeEach(() => {
        mockFilteringLog.publishEvent.mockClear();
        context = {
            requestUrl: 'https://example.org',
            referrerUrl: 'https://example.org',
            requestType: RequestType.Document,
            contentType: ContentType.Document,
            tabId: 0,
            frameId: 0,
            requestFrameId: 0,
            timestamp: Date.now(),
            thirdParty: false,
            matchingResult: null,
            requestHeaders: [{
                name: 'test_name',
                value: 'test_value',
            }],
            responseHeaders: [{
                name: 'test_name',
                value: 'test_value',
            }],
        } as RequestContext;
    });

    it('allowlists rules', () => {
        context.matchingResult = new MatchingResult([
            new NetworkRule('||example.com$csp=style-src *', 0),
            new NetworkRule('@@||example.com$csp=style-src *', 0),
        ], null);
        const hasModified = cspService.onHeadersReceived(context);

        expect(hasModified).toBeFalsy();
        expect(mockFilteringLog.publishEvent).toHaveBeenCalledWith(
            expect.objectContaining({ type: FilteringEventType.ApplyCspRule }),
        );
    });
});
