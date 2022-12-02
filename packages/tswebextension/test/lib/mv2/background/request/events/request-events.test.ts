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
        tabId: 1,
        frameId: 0,
        requestUrl: 'https://example.com/',
        referrerUrl: 'https://testcases.adguard.com',
        requestFrameId: 0,
        requestType: RequestType.Document,
        method: 'GET',
        contentType: ContentType.DOCUMENT,
        thirdParty: true,
    };

    beforeAll(() => {
        RequestEvents.init();
    });

    it('onBeforeRequest', () => {
        const listener = jest.fn();

        RequestEvents.onBeforeRequest.addListener(listener);

        const timestamp = Date.now();

        const details: WebRequest.OnBeforeRequestDetailsType = {
            ...commonRequestData,
            initiator: 'https://testcases.adguard.com',
            timeStamp: timestamp,
        };

        const expectedContext = {
            state: RequestContextState.BEFORE_REQUEST,
            timestamp,
            ...commonContextData,
        };

        jest.spyOn(Date, 'now').mockReturnValueOnce(timestamp);

        browser.webRequest.onBeforeRequest.dispatch(details);

        expect(listener).toBeCalledWith({ details, context: expectedContext });
    });

    it('onBeforeSendHeaders', () => {
        const listener = jest.fn();

        RequestEvents.onBeforeSendHeaders.addListener(listener);

        const timestamp = Date.now();

        const details: WebRequest.OnBeforeSendHeadersDetailsType = {
            ...commonRequestData,
            timeStamp: timestamp,
        };

        const expectedContext = {
            state: RequestContextState.BEFORE_SEND_HEADERS,
            timestamp,
            ...commonContextData,
        };

        jest.spyOn(Date, 'now').mockReturnValueOnce(timestamp);

        browser.webRequest.onBeforeSendHeaders.dispatch(details);

        expect(listener).toBeCalledWith({ details, context: expectedContext });
    });

    it('onSendHeaders', () => {
        const listener = jest.fn();

        RequestEvents.onSendHeaders.addListener(listener);

        const timestamp = Date.now();

        const details: WebRequest.OnSendHeadersDetailsType = {
            ...commonRequestData,
            timeStamp: timestamp,
        };

        const expectedContext = {
            state: RequestContextState.SEND_HEADERS,
            timestamp,
            ...commonContextData,
        };

        jest.spyOn(Date, 'now').mockReturnValueOnce(timestamp);

        browser.webRequest.onSendHeaders.dispatch(details);

        expect(listener).toBeCalledWith({ details, context: expectedContext });
    });

    it('onHeadersReceived', () => {
        const listener = jest.fn();

        RequestEvents.onHeadersReceived.addListener(listener);

        const timestamp = Date.now();

        const details: WebRequest.OnHeadersReceivedDetailsType = {
            ...commonRequestData,
            responseHeaders: [
                {
                    name: 'content-type',
                    value: 'text/html; charset=UTF-8',
                },
            ],
            statusCode: 200,
            statusLine: 'HTTP/1.1 200',
            timeStamp: timestamp,
        };

        const expectedContext = {
            state: RequestContextState.HEADERS_RECEIVED,
            responseHeaders: [
                {
                    name: 'content-type',
                    value: 'text/html; charset=UTF-8',
                },
            ],
            statusCode: 200,
            timestamp,
            ...commonContextData,
        };

        jest.spyOn(Date, 'now').mockReturnValueOnce(timestamp);

        browser.webRequest.onHeadersReceived.dispatch(details);

        expect(listener).toBeCalledWith({ details, context: expectedContext });
    });

    it('onAuthRequired', () => {
        expect(browser.webRequest.onAuthRequired.addListener.calledOnce);
    });

    it('onBeforeRedirect', () => {
        expect(browser.webRequest.onBeforeRedirect.addListener.calledOnce);
    });

    it('onResponseStarted', () => {
        const listener = jest.fn();

        RequestEvents.onResponseStarted.addListener(listener);

        const timestamp = Date.now();

        const details: WebRequest.OnResponseStartedDetailsType = {
            ...commonRequestData,
            fromCache: true,
            ip: '0.0.0.0',
            statusCode: 200,
            statusLine: 'HTTP/1.1 200',
            timeStamp: timestamp,
        };

        const expectedContext = {
            state: RequestContextState.RESPONSE_STARTED,
            responseHeaders: [
                {
                    name: 'content-type',
                    value: 'text/html; charset=UTF-8',
                },
            ],
            statusCode: 200,
            timestamp,
            ...commonContextData,
        };

        jest.spyOn(Date, 'now').mockReturnValueOnce(timestamp);

        browser.webRequest.onResponseStarted.dispatch(details);

        expect(listener).toBeCalledWith({ details, context: expectedContext });
    });

    it('onCompleted', () => {
        const listener = jest.fn();

        RequestEvents.onCompleted.addListener(listener);

        const timestamp = Date.now();

        const details: WebRequest.OnCompletedDetailsType = {
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
            timeStamp: timestamp,
            urlClassification: {
                firstParty: [],
                thirdParty: [],
            },
            requestSize: 0,
            responseSize: 0,
        };

        const expectedContext = {
            state: RequestContextState.COMPLETED,
            responseHeaders: [
                {
                    name: 'content-type',
                    value: 'text/html; charset=UTF-8',
                },
            ],
            statusCode: 200,
            timestamp,
            ...commonContextData,
        };

        jest.spyOn(Date, 'now').mockReturnValueOnce(timestamp);

        browser.webRequest.onCompleted.dispatch(details);

        expect(listener).toBeCalledWith({ details, context: expectedContext });
    });

    it('onErrorOccurred', () => {
        const listener = jest.fn();

        RequestEvents.onErrorOccurred.addListener(listener);

        const timestamp = Date.now();

        const details: WebRequest.OnErrorOccurredDetailsType = {
            ...commonRequestData,
            error: 'net::ERR_CONNECTION_REFUSED',
            fromCache: false,
            initiator: 'https://example.com',
            timeStamp: timestamp,
        };

        const expectedContext = {
            state: RequestContextState.ERROR,
            responseHeaders: [
                {
                    name: 'content-type',
                    value: 'text/html; charset=UTF-8',
                },
            ],
            statusCode: 200,
            timestamp,
            ...commonContextData,
        };

        jest.spyOn(Date, 'now').mockReturnValueOnce(timestamp);

        browser.webRequest.onErrorOccurred.dispatch(details);

        expect(listener).toBeCalledWith({ details, context: expectedContext });
    });
});
