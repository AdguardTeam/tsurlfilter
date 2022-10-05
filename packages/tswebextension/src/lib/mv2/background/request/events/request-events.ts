import browser, { WebRequest } from 'webextension-polyfill';

import { requestContextStorage, RequestContextState } from '../request-context-storage';
import { RequestEvent, BrowserRequestEvent } from './request-event';
import { isChrome } from '../../utils/browser-detector';
import {
    isThirdPartyRequest,
    getRequestType,
} from '../../../../common';
import { tabsApi } from '../../tabs';

const MAX_URL_LENGTH = 1024 * 16;

// TODO: firefox adapter

export type OnBeforeRequest = BrowserRequestEvent<
WebRequest.OnBeforeRequestDetailsType,
WebRequest.OnBeforeRequestOptions
>;

export const onBeforeRequest = new RequestEvent(
    browser.webRequest.onBeforeRequest as OnBeforeRequest,
    (details) => {
        const {
            requestId,
            type,
            frameId,
            tabId,
            parentFrameId,
            originUrl,
            initiator,
            method,
            timeStamp,
        } = details;

        let { url } = details;

        /**
         * truncate too long urls
         * https://github.com/AdguardTeam/AdguardBrowserExtension/issues/1493
         */
        if (url.length > MAX_URL_LENGTH) {
            url = url.slice(0, MAX_URL_LENGTH);
        }

        /**
         * FF sends http instead of ws protocol at the http-listeners layer
         * Although this is expected, as the Upgrade request is indeed an HTTP request,
         * we use a chromium based approach in this case.
         */
        if (type === 'websocket' && url.indexOf('http') === 0) {
            url = url.replace(/^http(s)?:/, 'ws$1:');
        }

        const { requestType, contentType } = getRequestType(type);

        let requestFrameId = type === 'main_frame' ? frameId : parentFrameId;

        // Relate request to main_frame
        if (requestFrameId === -1) {
            requestFrameId = 0;
        }

        const referrerUrl = originUrl
            || initiator
            || tabsApi.getTabMainFrame(tabId)?.url
            || tabsApi.getTabFrame(tabId, requestFrameId)?.url
            || url;

        const thirdParty = isThirdPartyRequest(url, referrerUrl);

        const context = requestContextStorage.record(requestId, {
            state: RequestContextState.BEFORE_REQUEST,
            requestId,
            frameId,
            tabId,
            timestamp: timeStamp,
            requestUrl: url,
            referrerUrl,
            requestType,
            requestFrameId,
            thirdParty,
            contentType,
            method,
        });

        return { details, context };
    },
    { urls: ['<all_urls>'] },
    ['blocking', 'requestBody'],
);

export type OnBeforeSendHeaders = BrowserRequestEvent<
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

export type OnSendHeaders = BrowserRequestEvent<
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

export type OnHeadersReceived = BrowserRequestEvent<
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

export type OnAuthRequired = BrowserRequestEvent<
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

export type OnBeforeRedirect = BrowserRequestEvent<
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

export type OnResponseStarted = BrowserRequestEvent<
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

export type OnCompleted = BrowserRequestEvent<
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

export type OnErrorOccurred = BrowserRequestEvent<
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
