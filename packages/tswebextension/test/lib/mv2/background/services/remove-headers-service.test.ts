import {
    MatchingResult,
    NetworkRule,
    RequestType,
    HTTPMethod,
} from '@adguard/tsurlfilter';
import { RemoveHeadersService } from '@lib/mv2/background/services/remove-headers-service';
import { RequestContext, RequestContextState } from '@lib/mv2/background/request';
import { FilteringEventType, ContentType } from '@lib/common';
import { MockFilteringLog } from '../../../common/mocks/mock-filtering-log';

describe('Headers service', () => {
    const mockFilteringLog = new MockFilteringLog();
    const removeHeadersService = new RemoveHeadersService(mockFilteringLog);

    const requestHeader = {
        name: 'req_header_name',
        value: 'request_header_value',
    };

    const responseHeader = {
        name: 'resp_header_name',
        value: 'resp_header_value',
    };

    const getContextTemplate = (): RequestContext => ({
        requestId: 'request_1',
        eventId: 'event_1',
        state: RequestContextState.BeforeRequest,
        method: HTTPMethod.GET,
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
        requestHeaders: [requestHeader],
        responseHeaders: [responseHeader],
    });

    let context: RequestContext;

    const runOnBeforeSendHeaders = (): boolean => {
        return removeHeadersService.onBeforeSendHeaders(context);
    };

    const runOnHeadersReceived = (): boolean => {
        return removeHeadersService.onHeadersReceived(context);
    };

    beforeEach(() => {
        context = getContextTemplate();
        mockFilteringLog.publishEvent.mockClear();
    });

    it('removes request headers', () => {
        let headersModified = runOnBeforeSendHeaders();
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
            new NetworkRule('||example.org^$removeheader=resp_header_name', 0),
        ], null);
        headersModified = runOnBeforeSendHeaders();
        expect(headersModified).toBeFalsy();
        expect(mockFilteringLog.publishEvent).not.toHaveBeenCalledWith(
            expect.objectContaining({ type: FilteringEventType.RemoveHeader }),
        );

        context.matchingResult = new MatchingResult([
            new NetworkRule('||example.org^$removeheader=request:req_header_name', 0),
        ], null);
        headersModified = runOnBeforeSendHeaders();
        expect(headersModified).toBeTruthy();
        expect(mockFilteringLog.publishEvent).toHaveBeenCalledWith(
            expect.objectContaining({ type: FilteringEventType.RemoveHeader }),
        );
    });

    it('removes response headers', () => {
        let headersModified = runOnHeadersReceived();
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
            new NetworkRule('||example.org^$removeheader=request:req_header_name', 0),
        ], null);
        headersModified = runOnHeadersReceived();
        expect(headersModified).toBeFalsy();
        expect(mockFilteringLog.publishEvent).not.toHaveBeenCalledWith(
            expect.objectContaining({ type: FilteringEventType.RemoveHeader }),
        );

        context.matchingResult = new MatchingResult([
            new NetworkRule('||example.org^$removeheader=resp_header_name', 0),
        ], null);
        headersModified = runOnHeadersReceived();
        expect(headersModified).toBeTruthy();
        expect(mockFilteringLog.publishEvent).toHaveBeenCalledWith(
            expect.objectContaining({ type: FilteringEventType.RemoveHeader }),
        );
    });

    describe('allowlisting logic', () => {
        // Request headers cases
        it('Req: allowlists rules to prevent headers modifications', () => {
            context.matchingResult = new MatchingResult([
                new NetworkRule('||example.com$removeheader=request:req_header_name', 0),
                new NetworkRule('@@||example.com$removeheader=request:req_header_name', 0),
            ], null);

            const headersModified = runOnBeforeSendHeaders();
            expect(headersModified).toBeFalsy();
            expect(context.requestHeaders).toContainEqual(requestHeader);
            expect(mockFilteringLog.publishEvent).toHaveBeenCalledWith(
                expect.objectContaining({ type: FilteringEventType.RemoveHeader }),
            );
        });

        it('Req: does not log allowlist rule if its modifier value header is not contained in context headers', () => {
            // Rule is considered applicable, if given headers list contains rule's modifiers header
            context.matchingResult = new MatchingResult([
                new NetworkRule('||example.com$removeheader=request:non_applicable', 0),
                new NetworkRule('@@||example.com$removeheader=request:non_applicable', 0),
            ], null);

            const headersModified = runOnBeforeSendHeaders();
            expect(headersModified).toBeFalsy();
            expect(context.requestHeaders).toContainEqual(requestHeader);
            expect(mockFilteringLog.publishEvent).not.toHaveBeenCalled();
        });

        // Response headers cases
        it('Resp: allowlists rules to prevent headers modifications', () => {
            context.matchingResult = new MatchingResult([
                new NetworkRule('||example.com$removeheader=resp_header_name', 0),
                new NetworkRule('@@||example.com$removeheader=resp_header_name', 0),
            ], null);

            const headersModified = runOnHeadersReceived();
            expect(headersModified).toBeFalsy();
            expect(context.responseHeaders).toContainEqual(responseHeader);
            expect(mockFilteringLog.publishEvent).toHaveBeenCalledWith(
                expect.objectContaining({ type: FilteringEventType.RemoveHeader }),
            );
        });

        it('Resp: does not log allowlist rule if its modifier value header is not contained in context headers', () => {
            // Rule is considered applicable, if given headers list contains rule's modifiers header
            context.matchingResult = new MatchingResult([
                new NetworkRule('||example.com$removeheader=non_applicable', 0),
                new NetworkRule('@@||example.com$removeheader=non_applicable', 0),
            ], null);

            const headersModified = runOnHeadersReceived();
            expect(headersModified).toBeFalsy();
            expect(context.responseHeaders).toContainEqual(responseHeader);
            expect(mockFilteringLog.publishEvent).not.toHaveBeenCalled();
        });

        it('does not log non-applicable allowlist rule if some other rules were applied before', () => {
            const modifyingRule = new NetworkRule('||example.com$removeheader=resp_header_name', 0);
            // Rule is considered applicable, if given headers list contains rule's modifiers header
            context.matchingResult = new MatchingResult([
                modifyingRule,
                new NetworkRule('||example.com$removeheader=non_applicable', 0),
                new NetworkRule('@@||example.com$removeheader=non_applicable', 0),
            ], null);

            const headersModified = runOnHeadersReceived();
            expect(headersModified).toBeTruthy();
            expect(context.responseHeaders).not.toContainEqual(responseHeader);
            expect(mockFilteringLog.publishEvent).toHaveBeenCalledTimes(1);
            expect(mockFilteringLog.publishEvent).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: FilteringEventType.RemoveHeader,
                    data: expect.objectContaining({
                        rule: modifyingRule,
                    }),
                }),
            );
        });
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
