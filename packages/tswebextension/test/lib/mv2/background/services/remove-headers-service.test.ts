import { MatchingResult, NetworkRule, RequestType } from '@adguard/tsurlfilter';
import { RemoveHeadersService } from '@lib/mv2/background/services/remove-headers-service';
import { RequestContext } from '@lib/mv2/background/request';
import { FilteringEventType, ContentType } from '@lib/common';
import { MockFilteringLog } from '../../../common/mocks/mock-filtering-log';

describe('Headers service', () => {
    const mockFilteringLog = new MockFilteringLog();
    const removeHeadersService = new RemoveHeadersService(mockFilteringLog);

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
            requestHeaders: [{
                name: 'test_name',
                value: 'test_value',
            }],
            responseHeaders: [{
                name: 'test_name',
                value: 'test_value',
            }],
        } as RequestContext;
    };

    let context = getContext();

    const runOnBeforeSendHeaders = (): boolean => {
        return removeHeadersService.onBeforeSendHeaders(context);
    };

    const runOnHeadersReceived = (): boolean => {
        return removeHeadersService.onHeadersReceived(context);
    };

    beforeEach(() => {
        context = getContext();
        mockFilteringLog.publishEvent.mockClear();
    });

    it('checks removing request headers', () => {
        let headersModified = removeHeadersService.onBeforeSendHeaders(context);
        expect(headersModified).toBeFalsy();
        expect(mockFilteringLog.publishEvent).not.toHaveBeenCalledWith(
            expect.objectContaining({ type: FilteringEventType.RemoveHeader }),
        );

        headersModified = runOnBeforeSendHeaders();
        expect(headersModified).toBeFalsy();
        expect(mockFilteringLog.publishEvent).not.toHaveBeenCalledWith(
            expect.objectContaining({ type: FilteringEventType.RemoveHeader }),
        );
        context.matchingResult = new MatchingResult([
            new NetworkRule('||example.org^$removeheader=an-other', 0),
        ], null);
        headersModified = runOnBeforeSendHeaders();
        expect(headersModified).toBeFalsy();
        expect(mockFilteringLog.publishEvent).not.toHaveBeenCalledWith(
            expect.objectContaining({ type: FilteringEventType.RemoveHeader }),
        );

        context.matchingResult = new MatchingResult([
            new NetworkRule('||example.org^$removeheader=test_name', 0),
        ], null);
        headersModified = runOnBeforeSendHeaders();
        expect(headersModified).toBeFalsy();
        expect(mockFilteringLog.publishEvent).not.toHaveBeenCalledWith(
            expect.objectContaining({ type: FilteringEventType.RemoveHeader }),
        );

        context.matchingResult = new MatchingResult([
            new NetworkRule('||example.org^$removeheader=request:test_name', 0),
        ], null);
        headersModified = runOnBeforeSendHeaders();
        expect(headersModified).toBeTruthy();
        expect(mockFilteringLog.publishEvent).toHaveBeenCalledWith(
            expect.objectContaining({ type: FilteringEventType.RemoveHeader }),
        );
    });

    it('checks removing response headers', () => {
        let headersModified = removeHeadersService.onHeadersReceived(context);
        expect(headersModified).toBeFalsy();
        expect(mockFilteringLog.publishEvent).not.toHaveBeenCalledWith(
            expect.objectContaining({ type: FilteringEventType.RemoveHeader }),
        );

        headersModified = runOnHeadersReceived();
        expect(headersModified).toBeFalsy();
        expect(mockFilteringLog.publishEvent).not.toHaveBeenCalledWith(
            expect.objectContaining({ type: FilteringEventType.RemoveHeader }),
        );

        context.matchingResult = new MatchingResult([
            new NetworkRule('||example.org^$removeheader=an-other', 0),
        ], null);
        headersModified = runOnHeadersReceived();
        expect(headersModified).toBeFalsy();
        expect(mockFilteringLog.publishEvent).not.toHaveBeenCalledWith(
            expect.objectContaining({ type: FilteringEventType.RemoveHeader }),
        );

        context.matchingResult = new MatchingResult([
            new NetworkRule('||example.org^$removeheader=request:test_name', 0),
        ], null);
        headersModified = runOnHeadersReceived();
        expect(headersModified).toBeFalsy();
        expect(mockFilteringLog.publishEvent).not.toHaveBeenCalledWith(
            expect.objectContaining({ type: FilteringEventType.RemoveHeader }),
        );

        context.matchingResult = new MatchingResult([
            new NetworkRule('||example.org^$removeheader=test_name', 0),
        ], null);
        headersModified = runOnHeadersReceived();
        expect(headersModified).toBeTruthy();
        expect(mockFilteringLog.publishEvent).toHaveBeenCalledWith(
            expect.objectContaining({ type: FilteringEventType.RemoveHeader }),
        );
    });

    it('correctly applies matching header modifier rules', () => {
        context.matchingResult = new MatchingResult([
            new NetworkRule('||example.org^$header=test_name:test_value,removeheader=test_name', 0),
        ], null);
        const headersModified = removeHeadersService.onHeadersReceived(context);
        expect(headersModified).toBeTruthy();
        expect(mockFilteringLog.publishEvent).toHaveBeenCalledWith(
            expect.objectContaining({ type: FilteringEventType.RemoveHeader }),
        );
    });

    it('does not apply non-matching header modifier rules', () => {
        context.matchingResult = new MatchingResult([
            new NetworkRule('||example.org^$header=test_name:NOT_test_value,removeheader=test_name', 0),
        ], null);
        const headersModified = removeHeadersService.onHeadersReceived(context);
        expect(headersModified).toBeFalsy();
        expect(mockFilteringLog.publishEvent).not.toHaveBeenCalledWith(
            expect.objectContaining({ type: FilteringEventType.RemoveHeader }),
        );
    });
});
