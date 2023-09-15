import { MatchingResult, NetworkRule, RequestType } from '@adguard/tsurlfilter';
import { CspService } from '@lib/mv2/background/services/csp-service';
import { RequestContext } from '@lib/mv2/background/request';
import { FilteringEventType, ContentType } from '@lib/common';
import { MockFilteringLog } from '../../../common/mocks/mock-filtering-log';

describe('Content Security Policy service', () => {
    const mockFilteringLog = new MockFilteringLog();
    const cspService = new CspService(mockFilteringLog);

    const getContext = (): RequestContext => {
        return {
            requestUrl: 'https://example.org',
            referrerUrl: 'https://example.org',
            requestType: RequestType.Document,
            contentType: ContentType.Document,
            tabId: 0,
            frameId: 0,
            requestFrameId: 0,
            timestamp: Date.now(),
            thirdParty: false,
            matchingResult: new MatchingResult([], null),
            responseHeaders: [{
                name: 'test_name',
                value: 'test_value',
            }],
        } as RequestContext;
    };

    let context = getContext();

    const runOnHeadersReceived = (): boolean => {
        return cspService.onHeadersReceived(context);
    };

    beforeEach(() => {
        context = getContext();
        mockFilteringLog.publishEvent.mockClear();
    });

    it('correctly applies matching header modifier rules', () => {
        context.matchingResult = new MatchingResult([
            new NetworkRule(String.raw`||example.org^$header=test_name:test_value,csp=frame-src 'none'`, 0),
        ], null);
        const headersModified = runOnHeadersReceived();
        expect(headersModified).toBeTruthy();
        expect(mockFilteringLog.publishEvent).toHaveBeenCalledWith(
            expect.objectContaining({ type: FilteringEventType.ApplyCspRule }),
        );
    });

    it('does not apply non-matching header modifier rules', () => {
        context.matchingResult = new MatchingResult([
            new NetworkRule(String.raw`||example.org^$header=NOT_test_name:test_value,csp=frame-src 'none'`, 0),
        ], null);
        const headersModified = runOnHeadersReceived();
        expect(headersModified).toBeFalsy();
        expect(mockFilteringLog.publishEvent).not.toHaveBeenCalledWith(
            expect.objectContaining({ type: FilteringEventType.ApplyCspRule }),
        );
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
