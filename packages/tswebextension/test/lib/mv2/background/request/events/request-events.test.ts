import browser from 'sinon-chrome';
import { WebRequest } from 'webextension-polyfill';
import { RequestType } from '@adguard/tsurlfilter';

import { RequestEvents } from '@lib/mv2/background/request/events/request-events';
import { RequestContext, RequestContextState } from '@lib/mv2/background/request';

import { ContentType } from '@lib/common';

describe('Request Events', () => {
    const commonRequestData = {
        requestId: '12345',
        frameId: 0,
        method: 'GET',
        parentFrameId: -1,
        tabId: 1,
        type: 'main_frame' as WebRequest.ResourceType,
        url: 'https://example.com/',
        thirdParty: false,
    };

    const commonContextData: Partial<RequestContext> = {
        requestId: '12345',
        eventId: '1',
        tabId: 1,
        frameId: 0,
        requestUrl: 'https://example.com/',
        referrerUrl: 'https://testcases.adguard.com',
        requestFrameId: 0,
        requestType: RequestType.Document,
        method: 'GET',
        contentType: ContentType.Document,
        thirdParty: true,
    };

    it('onBeforeRequest with prerender request', async () => {
        RequestEvents.init();

        const listener = jest.fn();

        RequestEvents.onBeforeRequest.addListener(listener);

        const timestamp = Date.now();

        const prerenderRequestDetails: WebRequest.OnBeforeRequestDetailsType = {
            ...commonRequestData,
            // Tab id will be not the same with the current opened tab.
            tabId: commonRequestData.tabId + 1,
            timeStamp: timestamp,
        };

        const prerenderRequestContext = {
            state: RequestContextState.BeforeRequest,
            timestamp,
            ...commonContextData,
            tabId: commonRequestData.tabId + 1,
            referrerUrl: commonRequestData.url,
            thirdParty: false,
        };

        jest.spyOn(Date, 'now').mockReturnValueOnce(timestamp);

        browser.webRequest.onBeforeRequest.dispatch(prerenderRequestDetails);

        // Then simulate request with navigation change.
        const requestDetails: WebRequest.OnBeforeRequestDetailsType = {
            ...commonRequestData,
            timeStamp: timestamp,
            url: 'https://example.org/',
        };

        const requestContext = {
            ...commonContextData,
            state: RequestContextState.BeforeRequest,
            timestamp,
            referrerUrl: 'https://example.org/',
            requestUrl: 'https://example.org/',
            thirdParty: false,
        };

        browser.webRequest.onBeforeRequest.dispatch(requestDetails);

        // First prerender request
        expect(listener).toHaveBeenNthCalledWith(1, expect.objectContaining({
            details: prerenderRequestDetails,
            context: prerenderRequestContext,
        }));

        // Second real navigation request
        expect(listener).toHaveBeenNthCalledWith(2, expect.objectContaining({
            details: requestDetails,
            context: requestContext,
        }));
    });

    describe.each([
        {
            testName: 'onBeforeRequest',
            testEventChannel: RequestEvents.onBeforeRequest,
            browserEventChannel: browser.webRequest.onBeforeRequest,
            details: <WebRequest.OnBeforeRequestDetailsType>{
                ...commonRequestData,
                initiator: 'https://testcases.adguard.com',
            },
            context: {
                state: RequestContextState.BeforeRequest,
                ...commonContextData,
            },
        },
        {
            testName: 'onBeforeSendHeaders',
            testEventChannel: RequestEvents.onBeforeSendHeaders,
            browserEventChannel: browser.webRequest.onBeforeSendHeaders,
            details: <WebRequest.OnBeforeSendHeadersDetailsType>{
                ...commonRequestData,
            },
            context: {
                state: RequestContextState.BeforeSendHeaders,
                ...commonContextData,
            },
        },
        {
            testName: 'onSendHeaders',
            testEventChannel: RequestEvents.onSendHeaders,
            browserEventChannel: browser.webRequest.onSendHeaders,
            details: <WebRequest.OnSendHeadersDetailsType>{
                ...commonRequestData,
            },
            context: {
                state: RequestContextState.SendHeaders,
                ...commonContextData,
            },
        },
        {
            testName: 'onHeadersReceived',
            testEventChannel: RequestEvents.onHeadersReceived,
            browserEventChannel: browser.webRequest.onHeadersReceived,
            details: <WebRequest.OnHeadersReceivedDetailsType>{
                ...commonRequestData,
                responseHeaders: [
                    {
                        name: 'content-type',
                        value: 'text/html; charset=UTF-8',
                    },
                ],
                statusCode: 200,
                statusLine: 'HTTP/1.1 200',
            },
            context: {
                state: RequestContextState.HeadersReceived,
                responseHeaders: [
                    {
                        name: 'content-type',
                        value: 'text/html; charset=UTF-8',
                    },
                ],
                statusCode: 200,
                ...commonContextData,
            },
        },
        {
            testName: 'onResponseStarted',
            testEventChannel: RequestEvents.onResponseStarted,
            browserEventChannel: browser.webRequest.onResponseStarted,
            details: <WebRequest.OnResponseStartedDetailsType>{
                ...commonRequestData,
                fromCache: true,
                ip: '0.0.0.0',
                statusCode: 200,
                statusLine: 'HTTP/1.1 200',
            },
            context: {
                state: RequestContextState.ResponseStarted,
                responseHeaders: [
                    {
                        name: 'content-type',
                        value: 'text/html; charset=UTF-8',
                    },
                ],
                statusCode: 200,
                ...commonContextData,
            },
        },
        {
            testName: 'onCompleted',
            testEventChannel: RequestEvents.onCompleted,
            browserEventChannel: browser.webRequest.onCompleted,
            details: <WebRequest.OnCompletedDetailsType>{
                ...commonRequestData,
                fromCache: true,
                ip: '93.184.216.34',
                responseHeaders: [
                    {
                        name: 'content-type',
                        value: 'text/html; charset=UTF-8',
                    },
                ],
                statusCode: 200,
                statusLine: 'HTTP/1.1 200',
                urlClassification: {
                    firstParty: [],
                    thirdParty: [],
                },
                requestSize: 0,
                responseSize: 0,
                // Will be set it test body.
                timeStamp: 0,
            },
            context: {
                state: RequestContextState.Completed,
                responseHeaders: [
                    {
                        name: 'content-type',
                        value: 'text/html; charset=UTF-8',
                    },
                ],
                statusCode: 200,
                ...commonContextData,
            },
        },
        {
            testName: 'onErrorOccurred',
            testEventChannel: RequestEvents.onErrorOccurred,
            browserEventChannel: browser.webRequest.onErrorOccurred,
            details: <WebRequest.OnErrorOccurredDetailsType>{
                ...commonRequestData,
                error: 'net::ERR_CONNECTION_REFUSED',
                fromCache: false,
                initiator: 'https://example.com',
            },
            context: {
                state: RequestContextState.Error,
                responseHeaders: [
                    {
                        name: 'content-type',
                        value: 'text/html; charset=UTF-8',
                    },
                ],
                statusCode: 200,
                ...commonContextData,
            },
        },
    ])('listener called on ', ({
        testName,
        details,
        context,
        testEventChannel,
        browserEventChannel,
    }) => {
        test(testName, () => {
            RequestEvents.init();

            const listener = jest.fn();

            testEventChannel.addListener(listener);

            const timestamp = Date.now();

            details.timeStamp = timestamp;
            context.timestamp = timestamp;

            jest.spyOn(Date, 'now').mockReturnValueOnce(timestamp);

            browserEventChannel.dispatch(details);

            expect(listener).toBeCalledWith({ details, context });
        });
    });

    it('onAuthRequired', () => {
        expect(browser.webRequest.onAuthRequired.addListener.calledOnce);
    });

    it('onBeforeRedirect', () => {
        expect(browser.webRequest.onBeforeRedirect.addListener.calledOnce);
    });
});
