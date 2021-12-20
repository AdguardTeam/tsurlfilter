import { WebRequest } from 'webextension-polyfill';
import { HeadersService } from '../../../src/background/services/headers-service';
import { MockFilteringLog } from '../mock-filtering-log';
import { MatchingResult, NetworkRule, RequestType } from '@adguard/tsurlfilter';
import { RequestData } from '../../../src/background/request/events/request-event';
import { ContentType } from '../../../src/background/request';
import OnBeforeSendHeadersDetailsType = WebRequest.OnBeforeSendHeadersDetailsType;
import OnHeadersReceivedDetailsType = WebRequest.OnHeadersReceivedDetailsType;

describe('Headers service', () => {
    const mockFilteringLog = new MockFilteringLog();
    const headersService = new HeadersService(mockFilteringLog);

    const details = {
        frameId: 0,
        method: 'GET',
        parentFrameId: 0,
        requestId: '1',
        tabId: 0,
        thirdParty: false,
        timeStamp: 0,
        type: 'main_frame',
        url: 'https://example.org',
    };

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
    };

    const requestHeaders = [{
        name: 'test_name',
        value: 'test_value',
    }];

    const runOnBeforeSendHeaders = () => {
        return headersService.onBeforeSendHeaders({
            context,
            details: { ...details, requestHeaders },
        } as RequestData<OnBeforeSendHeadersDetailsType>);
    };

    const responseHeaders = [{
        name: 'test_name',
        value: 'test_value',
    }];

    const runOnHeadersReceived = () => {
        return headersService.onHeadersReceived({
            context,
            details: { ...details, responseHeaders },
        } as RequestData<OnHeadersReceivedDetailsType>);
    };

    beforeEach(() => {
        mockFilteringLog.addRemoveHeaderEvent.mockClear();
    });

    it('checks removing request headers', () => {
        let headersModified = headersService.onBeforeSendHeaders({
            context,
            details: { ...details },
        } as RequestData<OnBeforeSendHeadersDetailsType>);
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
        let headersModified = headersService.onHeadersReceived({
            context,
            details: { ...details },
        } as RequestData<OnHeadersReceivedDetailsType>);
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
