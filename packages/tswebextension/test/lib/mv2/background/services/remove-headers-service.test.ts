import {
    describe,
    expect,
    beforeEach,
    it,
} from 'vitest';
import { MatchingResult, RequestType, HTTPMethod } from '@adguard/tsurlfilter';

import { createNetworkRule } from '../../../../helpers/rule-creator';
import { MockFilteringLog } from '../../../common/mocks/mock-filtering-log';
import { mockEngineApi } from '../../../../helpers/mocks';
import { getNetworkRuleFields } from '../helpers/rule-fields';
import { RemoveHeadersService } from '../../../../../src/lib/mv2/background/services/remove-headers-service';
import {
    type RequestContext,
    RequestContextState,
} from '../../../../../src/lib/mv2/background/request/request-context-storage';
import { FilteringEventType } from '../../../../../src/lib/common/filtering-log';
import { ContentType } from '../../../../../src/lib/common/request-type';

describe('RemoveHeadersService', () => {
    const mockFilteringLog = new MockFilteringLog();
    const removeHeadersService = new RemoveHeadersService(mockFilteringLog, mockEngineApi);

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
            createNetworkRule('||example.org^$removeheader=an-other', 0),
        ], null);
        headersModified = runOnBeforeSendHeaders();
        expect(headersModified).toBeFalsy();
        expect(mockFilteringLog.publishEvent).not.toHaveBeenCalledWith(
            expect.objectContaining({ type: FilteringEventType.RemoveHeader }),
        );

        context.matchingResult = new MatchingResult([
            createNetworkRule('||example.org^$removeheader=resp_header_name', 0),
        ], null);
        headersModified = runOnBeforeSendHeaders();
        expect(headersModified).toBeFalsy();
        expect(mockFilteringLog.publishEvent).not.toHaveBeenCalledWith(
            expect.objectContaining({ type: FilteringEventType.RemoveHeader }),
        );

        context.matchingResult = new MatchingResult([
            createNetworkRule('||example.org^$removeheader=request:req_header_name', 0),
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
            createNetworkRule('||example.org^$removeheader=an-other', 0),
        ], null);
        headersModified = runOnHeadersReceived();
        expect(headersModified).toBeFalsy();
        expect(mockFilteringLog.publishEvent).not.toHaveBeenCalledWith(
            expect.objectContaining({ type: FilteringEventType.RemoveHeader }),
        );

        context.matchingResult = new MatchingResult([
            createNetworkRule('||example.org^$removeheader=request:req_header_name', 0),
        ], null);
        headersModified = runOnHeadersReceived();
        expect(headersModified).toBeFalsy();
        expect(mockFilteringLog.publishEvent).not.toHaveBeenCalledWith(
            expect.objectContaining({ type: FilteringEventType.RemoveHeader }),
        );

        context.matchingResult = new MatchingResult([
            createNetworkRule('||example.org^$removeheader=resp_header_name', 0),
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
                createNetworkRule('||example.com$removeheader=request:req_header_name', 0),
                createNetworkRule('@@||example.com$removeheader=request:req_header_name', 0),
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
                createNetworkRule('||example.com$removeheader=request:non_applicable', 0),
                createNetworkRule('@@||example.com$removeheader=request:non_applicable', 0),
            ], null);

            const headersModified = runOnBeforeSendHeaders();
            expect(headersModified).toBeFalsy();
            expect(context.requestHeaders).toContainEqual(requestHeader);
            expect(mockFilteringLog.publishEvent).not.toHaveBeenCalled();
        });

        // Response headers cases
        it('Resp: allowlists rules to prevent headers modifications', () => {
            context.matchingResult = new MatchingResult([
                createNetworkRule('||example.com$removeheader=resp_header_name', 0),
                createNetworkRule('@@||example.com$removeheader=resp_header_name', 0),
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
                createNetworkRule('||example.com$removeheader=non_applicable', 0),
                createNetworkRule('@@||example.com$removeheader=non_applicable', 0),
            ], null);

            const headersModified = runOnHeadersReceived();
            expect(headersModified).toBeFalsy();
            expect(context.responseHeaders).toContainEqual(responseHeader);
            expect(mockFilteringLog.publishEvent).not.toHaveBeenCalled();
        });

        it('does not log non-applicable allowlist rule if some other rules were applied before', () => {
            const modifyingRule = createNetworkRule('||example.com$removeheader=resp_header_name', 0);
            // Rule is considered applicable, if given headers list contains rule's modifiers header
            context.matchingResult = new MatchingResult([
                modifyingRule,
                createNetworkRule('||example.com$removeheader=non_applicable', 0),
                createNetworkRule('@@||example.com$removeheader=non_applicable', 0),
            ], null);

            const headersModified = runOnHeadersReceived();
            expect(headersModified).toBeTruthy();
            expect(context.responseHeaders).not.toContainEqual(responseHeader);
            expect(mockFilteringLog.publishEvent).toHaveBeenCalledTimes(1);
            expect(mockFilteringLog.publishEvent).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: FilteringEventType.RemoveHeader,
                    data: expect.objectContaining(getNetworkRuleFields(modifyingRule)),
                }),
            );
        });
    });

    it('does not apply non-matching header modifier rules', () => {
        context.matchingResult = new MatchingResult([
            createNetworkRule('||example.org^$header=test_name:NOT_test_value,removeheader=test_name', 0),
        ], null);
        const headersModified = removeHeadersService.onHeadersReceived(context);
        expect(headersModified).toBeFalsy();
        expect(mockFilteringLog.publishEvent).not.toHaveBeenCalledWith(
            expect.objectContaining({ type: FilteringEventType.RemoveHeader }),
        );
    });
});
