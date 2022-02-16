import browser, { WebRequest } from 'webextension-polyfill';

import { requestContextStorage, RequestContextState } from '../request-context-storage';
import { RequestEvent, BrowserRequstEvent } from './request-event';
import { isChrome } from '../../utils/browser-detector';

// TODO: firefox adapter

export type OnBeforeRequest = BrowserRequstEvent<
WebRequest.OnBeforeRequestDetailsType,
WebRequest.OnBeforeRequestOptions
>;

export const onBeforeRequest = new RequestEvent(
    browser.webRequest.onBeforeRequest as OnBeforeRequest,
    (details) => {
        const {
            requestId,
            frameId,
            tabId,
            timeStamp,
        } = details;

        const context = requestContextStorage.record(requestId, {
            state: RequestContextState.BEFORE_REQUEST,
            requestId,
            frameId,
            tabId,
            timestamp: timeStamp,
        });

        return { details, context };
    },
    { urls: ['<all_urls>'] },
    ['blocking', 'requestBody'],
);

export type OnBeforeSendHeaders = BrowserRequstEvent<
WebRequest.OnBeforeSendHeadersDetailsType,
WebRequest.OnBeforeSendHeadersOptions
>;

const onBeforeSendHeadersOptions = ['requestHeaders', 'blocking'];

if (isChrome) {
    onBeforeSendHeadersOptions.push('extraHeaders');
}

export const onBeforeSendHeaders = new RequestEvent(
    browser.webRequest.onBeforeSendHeaders as OnBeforeSendHeaders,
    (details) => {
        const { requestId, timeStamp, requestHeaders } = details;

        const context = requestContextStorage.update(requestId, {
            state: RequestContextState.BEFORE_SEND_HEADERS,
            timestamp: timeStamp,
            requestHeaders,
        });

        return { details, context };
    },
    { urls: ['<all_urls>'] },
    onBeforeSendHeadersOptions,
);

export type OnSendHeaders = BrowserRequstEvent<
WebRequest.OnSendHeadersDetailsType,
WebRequest.OnSendHeadersOptions
>;

export const onSendHeaders = new RequestEvent(
    browser.webRequest.onSendHeaders as OnSendHeaders,
    (details) => {
        const { requestId, timeStamp } = details;

        const context = requestContextStorage.update(requestId, {
            state: RequestContextState.SEND_HEADERS,
            timestamp: timeStamp,
        });

        return { details, context };
    },
    { urls: ['<all_urls>'] },
);

export type OnHeadersReceived = BrowserRequstEvent<
WebRequest.OnHeadersReceivedDetailsType,
WebRequest.OnHeadersReceivedOptions
>;

const onHeadersReceivedOptions = ['responseHeaders', 'blocking'];

if (isChrome) {
    onHeadersReceivedOptions.push('extraHeaders');
}

export const onHeadersReceived = new RequestEvent(
    browser.webRequest.onHeadersReceived as OnHeadersReceived,
    (details) => {
        const {
            requestId,
            responseHeaders,
            statusCode,
        } = details;

        const context = requestContextStorage.update(requestId, {
            state: RequestContextState.HEADERS_RECEIVED,
            responseHeaders,
            statusCode,
        });

        return { details, context };
    },
    { urls: ['<all_urls>'] },
    onHeadersReceivedOptions,
);

export type OnAuthRequired = BrowserRequstEvent<
WebRequest.OnAuthRequiredDetailsType,
WebRequest.OnAuthRequiredOptions
>;

export const onAuthRequired = new RequestEvent(
    browser.webRequest.onAuthRequired as OnAuthRequired,
    (details) => {
        const { requestId, timeStamp } = details;

        const context = requestContextStorage.update(requestId, {
            state: RequestContextState.AUTH_REQUIRED,
            timestamp: timeStamp,
        });

        return { details, context };
    },
    { urls: ['<all_urls>'] },
);

export type OnBeforeRedirect = BrowserRequstEvent<
WebRequest.OnBeforeRedirectDetailsType,
WebRequest.OnBeforeRedirectOptions
>;

export const onBeforeRedirect = new RequestEvent(
    browser.webRequest.onBeforeRedirect as OnBeforeRedirect,
    (details) => {
        const { requestId, timeStamp } = details;

        const context = requestContextStorage.update(requestId, {
            state: RequestContextState.BEFORE_REDIRECT,
            timestamp: timeStamp,
        });

        return { details, context };
    },
    { urls: ['<all_urls>'] },
);

export type OnResponseStarted = BrowserRequstEvent<
WebRequest.OnResponseStartedDetailsType,
WebRequest.OnResponseStartedOptions
>;

export const onResponseStarted = new RequestEvent(
    browser.webRequest.onResponseStarted as OnResponseStarted,
    (details) => {
        const { requestId, timeStamp } = details;

        const context = requestContextStorage.update(requestId, {
            state: RequestContextState.RESPONSE_STARTED,
            timestamp: timeStamp,
        });

        return { details, context };
    },
    { urls: ['<all_urls>'] },
);

export type OnCompleted = BrowserRequstEvent<
WebRequest.OnCompletedDetailsType,
WebRequest.OnCompletedOptions
>;

export const onCompleted = new RequestEvent(
    browser.webRequest.onCompleted as OnCompleted,
    (details) => {
        const { requestId, timeStamp } = details;

        const context = requestContextStorage.update(requestId, {
            state: RequestContextState.COMPLETED,
            timestamp: timeStamp,
        });

        return { details, context };
    },
    { urls: ['<all_urls>'] },
    ['responseHeaders'],
);

export type OnErrorOccurred = BrowserRequstEvent<
WebRequest.OnErrorOccurredDetailsType,
WebRequest.OnErrorOccurredOptions
>;

export const onErrorOccurred = new RequestEvent(
    browser.webRequest.onErrorOccurred as OnErrorOccurred,
    (details) => {
        const { requestId, timeStamp } = details;

        const context = requestContextStorage.update(requestId, {
            state: RequestContextState.ERROR,
            timestamp: timeStamp,
        });

        return { details, context };
    },
    { urls: ['<all_urls>'] },
);
