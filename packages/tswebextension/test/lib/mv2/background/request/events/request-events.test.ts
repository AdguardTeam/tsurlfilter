import browser from 'sinon-chrome';
import { WebRequest } from 'webextension-polyfill';

import * as RequestEvents from '@lib/mv2/background/request/events/request-events';
import { RequestContextState } from '@lib/mv2/background/request';

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
            frameId: commonRequestData.frameId,
            requestId: commonRequestData.requestId,
            tabId: commonRequestData.tabId,
            timestamp,
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
            frameId: commonRequestData.frameId,
            requestId: commonRequestData.requestId,
            tabId: commonRequestData.tabId,
            timestamp,
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
            frameId: commonRequestData.frameId,
            requestId: commonRequestData.requestId,
            tabId: commonRequestData.tabId,
            timestamp,
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
            frameId: commonRequestData.frameId,
            requestId: commonRequestData.requestId,
            tabId: commonRequestData.tabId,
            responseHeaders: [
                {
                    name: 'content-type',
                    value: 'text/html; charset=UTF-8',
                },
            ],
            statusCode: 200,
            timestamp,
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
            frameId: commonRequestData.frameId,
            requestId: commonRequestData.requestId,
            tabId: commonRequestData.tabId,
            responseHeaders: [
                {
                    name: 'content-type',
                    value: 'text/html; charset=UTF-8',
                },
            ],
            statusCode: 200,
            timestamp,
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
            frameId: commonRequestData.frameId,
            requestId: commonRequestData.requestId,
            tabId: commonRequestData.tabId,
            responseHeaders: [
                {
                    name: 'content-type',
                    value: 'text/html; charset=UTF-8',
                },
            ],
            statusCode: 200,
            timestamp,
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
            frameId: commonRequestData.frameId,
            requestId: commonRequestData.requestId,
            tabId: commonRequestData.tabId,
            responseHeaders: [
                {
                    name: 'content-type',
                    value: 'text/html; charset=UTF-8',
                },
            ],
            statusCode: 200,
            timestamp,
        };

        jest.spyOn(Date, 'now').mockReturnValueOnce(timestamp);

        browser.webRequest.onErrorOccurred.dispatch(details);

        expect(listener).toBeCalledWith({ details, context: expectedContext });
    });
});
