import { MatchingResult, NetworkRule, RequestType } from '@adguard/tsurlfilter';
import { HeadersService } from '@lib/mv2/background/services/headers-service';
import { ContentType, RequestContext } from '@lib/mv2/background/request';
import { MockFilteringLog } from '../../../common/mock-filtering-log';

describe('Headers service', () => {
    const mockFilteringLog = new MockFilteringLog();
    const headersService = new HeadersService(mockFilteringLog);

    const context = {
        requestUrl: 'https://example.org',
        referrerUrl: 'https://example.org',
        requestType: RequestType.Document,
        contentType: ContentType.DOCUMENT,
        tabId: 0,
        frameId: 0,
        requestFrameId: 0,
        timestamp: Date.now(),
        thirdParty: false,
        matchingResult: new MatchingResult([], null),
        requestHeaders: [{
            name: 'test_name',
            value: 'test_value',
        }],
        responseHeaders: [{
            name: 'test_name',
            value: 'test_value',
        }],
    };

    const runOnBeforeSendHeaders = () => {
        return headersService.onBeforeSendHeaders(context as RequestContext);
    };

    const runOnHeadersReceived = () => {
        return headersService.onHeadersReceived(context as RequestContext);
    };

    beforeEach(() => {
        mockFilteringLog.addRemoveHeaderEvent.mockClear();
    });

    it('checks removing request headers', () => {
        let headersModified = headersService.onBeforeSendHeaders(context as RequestContext);
        expect(headersModified).toBeFalsy();
        expect(mockFilteringLog.addRemoveHeaderEvent).not.toHaveBeenCalled();

        headersModified = runOnBeforeSendHeaders();
        expect(headersModified).toBeFalsy();
        expect(mockFilteringLog.addRemoveHeaderEvent).not.toHaveBeenCalled();

        context.matchingResult = new MatchingResult([
            new NetworkRule('||example.org^$removeheader=an-other', 0),
        ], null);
        headersModified = runOnBeforeSendHeaders();
        expect(headersModified).toBeFalsy();
        expect(mockFilteringLog.addRemoveHeaderEvent).not.toHaveBeenCalled();

        context.matchingResult = new MatchingResult([
            new NetworkRule('||example.org^$removeheader=test_name', 0),
        ], null);
        headersModified = runOnBeforeSendHeaders();
        expect(headersModified).toBeFalsy();
        expect(mockFilteringLog.addRemoveHeaderEvent).not.toHaveBeenCalled();

        context.matchingResult = new MatchingResult([
            new NetworkRule('||example.org^$removeheader=request:test_name', 0),
        ], null);
        headersModified = runOnBeforeSendHeaders();
        expect(headersModified).toBeTruthy();
        expect(mockFilteringLog.addRemoveHeaderEvent).toHaveBeenCalled();
    });

    it('checks removing response headers', () => {
        let headersModified = headersService.onHeadersReceived(context as RequestContext);
        expect(headersModified).toBeFalsy();
        expect(mockFilteringLog.addRemoveHeaderEvent).not.toHaveBeenCalled();

        headersModified = runOnHeadersReceived();
        expect(headersModified).toBeFalsy();
        expect(mockFilteringLog.addRemoveHeaderEvent).not.toHaveBeenCalled();

        context.matchingResult = new MatchingResult([
            new NetworkRule('||example.org^$removeheader=an-other', 0),
        ], null);
        headersModified = runOnHeadersReceived();
        expect(headersModified).toBeFalsy();
        expect(mockFilteringLog.addRemoveHeaderEvent).not.toHaveBeenCalled();

        context.matchingResult = new MatchingResult([
            new NetworkRule('||example.org^$removeheader=request:test_name', 0),
        ], null);
        headersModified = runOnHeadersReceived();
        expect(headersModified).toBeFalsy();
        expect(mockFilteringLog.addRemoveHeaderEvent).not.toHaveBeenCalled();

        context.matchingResult = new MatchingResult([
            new NetworkRule('||example.org^$removeheader=test_name', 0),
        ], null);
        headersModified = runOnHeadersReceived();
        expect(headersModified).toBeTruthy();
        expect(mockFilteringLog.addRemoveHeaderEvent).toHaveBeenCalled();
    });
});
