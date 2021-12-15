import browser, { WebRequest } from 'webextension-polyfill';

import { requestContextStorage } from '../request-context-storage';
import { RequestEvent, BrowserRequstEvent } from './request-event';


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
        } = details;


        const context = requestContextStorage.record(requestId, {
            frameId,
            tabId,
            timestamp: Date.now(),
        });

        return { details, context };
    },
    { urls: ['<all_urls>'] },
    ['blocking', 'requestBody'],
);



const handleDetails = <T extends { requestId: string, timeStamp: number }>(details: T) => {
    const { requestId, timeStamp } = details;
    const context = requestContextStorage.update(requestId, { timestamp: timeStamp });
    return { details, context };
};


export type OnBeforeSendHeaders = BrowserRequstEvent<
WebRequest.OnBeforeSendHeadersDetailsType,
WebRequest.OnBeforeSendHeadersOptions
>;

export const onBeforeSendHeaders = new RequestEvent(
    browser.webRequest.onBeforeSendHeaders as OnBeforeSendHeaders,
    handleDetails,
    { urls: ['<all_urls>'] },
);

export type OnSendHeaders = BrowserRequstEvent<
WebRequest.OnSendHeadersDetailsType,
WebRequest.OnSendHeadersOptions
>;

export const onSendHeaders = new RequestEvent(
    browser.webRequest.onSendHeaders as OnSendHeaders,
    handleDetails,
    { urls: ['<all_urls>'] },
);

export type OnHeadersReceived = BrowserRequstEvent<
WebRequest.OnHeadersReceivedDetailsType,
WebRequest.OnHeadersReceivedOptions
>;

export const onHeadersReceived = new RequestEvent(
    browser.webRequest.onHeadersReceived as OnHeadersReceived,
    handleDetails,
    { urls: ['<all_urls>'] },
    ['responseHeaders', 'blocking'],
);

export type OnAuthRequired = BrowserRequstEvent<
WebRequest.OnAuthRequiredDetailsType,
WebRequest.OnAuthRequiredOptions
>;

export const onAuthRequired = new RequestEvent(
    browser.webRequest.onAuthRequired as OnAuthRequired,
    handleDetails,
    { urls: ['<all_urls>'] },
);

export type OnBeforeRedirect = BrowserRequstEvent<
WebRequest.OnBeforeRedirectDetailsType,
WebRequest.OnBeforeRedirectOptions
>;

export const onBeforeRedirect = new RequestEvent(
    browser.webRequest.onBeforeRedirect as OnBeforeRedirect,
    handleDetails,
    { urls: ['<all_urls>'] },
);

export type OnResponseStarted = BrowserRequstEvent<
WebRequest.OnResponseStartedDetailsType,
WebRequest.OnResponseStartedOptions
>;

export const onResponseStarted = new RequestEvent(
    browser.webRequest.onResponseStarted as OnResponseStarted,
    handleDetails,
    { urls: ['<all_urls>'] },
);

export type OnCompleted = BrowserRequstEvent<
WebRequest.OnCompletedDetailsType,
WebRequest.OnCompletedOptions
>;

export const onCompleted = new RequestEvent(
    browser.webRequest.onCompleted as OnCompleted,
    handleDetails,
    { urls: ['<all_urls>'] },
    ['responseHeaders'],
);

export type OnErrorOccurred = BrowserRequstEvent<
WebRequest.OnErrorOccurredDetailsType,
WebRequest.OnErrorOccurredOptions
>;

export const onErrorOccurred = new RequestEvent(
    browser.webRequest.onErrorOccurred as OnErrorOccurred,
    handleDetails,
    { urls: ['<all_urls>'] },
);
