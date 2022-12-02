import browser, { WebRequest } from 'webextension-polyfill';

import { requestContextStorage, RequestContextState } from '../request-context-storage';
import { RequestEvent, RequestData } from './request-event';
import { isChrome } from '../../utils/browser-detector';
import {
    isThirdPartyRequest,
    getRequestType,
} from '../../../../common';
import { tabsApi } from '../../tabs';

const MAX_URL_LENGTH = 1024 * 16;

export class RequestEvents {
    public static onBeforeRequest = new RequestEvent<
        WebRequest.OnBeforeRequestDetailsType,
        WebRequest.OnBeforeRequestOptions
    >();

    public static onBeforeSendHeaders = new RequestEvent<
        WebRequest.OnBeforeSendHeadersDetailsType,
        WebRequest.OnBeforeSendHeadersOptions
    >();

    public static onSendHeaders = new RequestEvent<
        WebRequest.OnSendHeadersDetailsType,
        WebRequest.OnSendHeadersOptions
    >();

    public static onHeadersReceived = new RequestEvent<
        WebRequest.OnHeadersReceivedDetailsType,
        WebRequest.OnHeadersReceivedOptions
    >();

    public static onAuthRequired = new RequestEvent<
        WebRequest.OnAuthRequiredDetailsType,
        WebRequest.OnAuthRequiredOptions
    >();

    public static onBeforeRedirect = new RequestEvent<
        WebRequest.OnBeforeRedirectDetailsType,
        WebRequest.OnBeforeRedirectOptions
    >();

    public static onResponseStarted = new RequestEvent<
        WebRequest.OnResponseStartedDetailsType,
        WebRequest.OnResponseStartedOptions
    >();

    public static onCompleted = new RequestEvent<
        WebRequest.OnCompletedDetailsType,
        WebRequest.OnCompletedOptions
    >();

    public static onErrorOccurred = new RequestEvent<
        WebRequest.OnErrorOccurredDetailsType,
        WebRequest.OnErrorOccurredOptions
    >();

    public static init(): void {
        RequestEvents.onBeforeRequest.init(
            browser.webRequest.onBeforeRequest,
            RequestEvents.handleOnBeforeRequest,
            { urls: ['<all_urls>'] },
            ['blocking', 'requestBody'],
        );

        const onBeforeSendHeadersOptions: WebRequest.OnBeforeSendHeadersOptions[] = ['requestHeaders', 'blocking'];

        if (isChrome) {
            onBeforeSendHeadersOptions.push('extraHeaders');
        }

        RequestEvents.onBeforeSendHeaders.init(
            browser.webRequest.onBeforeSendHeaders,
            RequestEvents.handleOnBeforeSendHeaders,
            { urls: ['<all_urls>'] },
            onBeforeSendHeadersOptions,
        );

        RequestEvents.onSendHeaders.init(
            browser.webRequest.onSendHeaders,
            RequestEvents.handleSendHeaders,
            { urls: ['<all_urls>'] },
        );

        const onHeadersReceivedOptions: WebRequest.OnHeadersReceivedOptions[] = ['responseHeaders', 'blocking'];

        if (isChrome) {
            onHeadersReceivedOptions.push('extraHeaders');
        }

        RequestEvents.onHeadersReceived.init(
            browser.webRequest.onHeadersReceived,
            RequestEvents.handleOnHeadersReceived,
            { urls: ['<all_urls>'] },
            onHeadersReceivedOptions,
        );

        RequestEvents.onAuthRequired.init(
            browser.webRequest.onAuthRequired,
            RequestEvents.handleOnAuthRequired,
            { urls: ['<all_urls>'] },
        );

        RequestEvents.onBeforeRedirect.init(
            browser.webRequest.onBeforeRedirect,
            RequestEvents.handleOnBeforeRedirect,
            { urls: ['<all_urls>'] },
        );

        RequestEvents.onResponseStarted.init(
            browser.webRequest.onResponseStarted,
            RequestEvents.handleOnResponseStarted,
            { urls: ['<all_urls>'] },
        );

        RequestEvents.onCompleted.init(
            browser.webRequest.onCompleted,
            RequestEvents.handleOnCompleted,
            { urls: ['<all_urls>'] },
            ['responseHeaders'],
        );

        RequestEvents.onErrorOccurred.init(
            browser.webRequest.onErrorOccurred,
            RequestEvents.handleOnErrorOccurred,
            { urls: ['<all_urls>'] },
        );
    }

    private static handleOnBeforeRequest(
        details: WebRequest.OnBeforeRequestDetailsType,
    ): RequestData<WebRequest.OnBeforeRequestDetailsType> {
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
    }

    private static handleOnBeforeSendHeaders(
        details: WebRequest.OnBeforeSendHeadersDetailsType,
    ): RequestData<WebRequest.OnBeforeSendHeadersDetailsType> {
        const { requestId, timeStamp, requestHeaders } = details;

        const context = requestContextStorage.update(requestId, {
            state: RequestContextState.BEFORE_SEND_HEADERS,
            timestamp: timeStamp,
            requestHeaders,
        });

        return { details, context };
    }

    private static handleSendHeaders(
        details: WebRequest.OnSendHeadersDetailsType,
    ): RequestData<WebRequest.OnSendHeadersDetailsType> {
        const { requestId, timeStamp } = details;

        const context = requestContextStorage.update(requestId, {
            state: RequestContextState.SEND_HEADERS,
            timestamp: timeStamp,
        });

        return { details, context };
    }

    private static handleOnHeadersReceived(
        details: WebRequest.OnHeadersReceivedDetailsType,
    ): RequestData<WebRequest.OnHeadersReceivedDetailsType> {
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
    }

    private static handleOnAuthRequired(
        details: WebRequest.OnAuthRequiredDetailsType,
    ): RequestData<WebRequest.OnAuthRequiredDetailsType> {
        const { requestId, timeStamp } = details;

        const context = requestContextStorage.update(requestId, {
            state: RequestContextState.AUTH_REQUIRED,
            timestamp: timeStamp,
        });

        return { details, context };
    }

    private static handleOnBeforeRedirect(
        details: WebRequest.OnBeforeRedirectDetailsType,
    ): RequestData<WebRequest.OnBeforeRedirectDetailsType> {
        const { requestId, timeStamp } = details;

        const context = requestContextStorage.update(requestId, {
            state: RequestContextState.BEFORE_REDIRECT,
            timestamp: timeStamp,
        });

        return { details, context };
    }

    private static handleOnResponseStarted(
        details: WebRequest.OnResponseStartedDetailsType,
    ): RequestData<WebRequest.OnResponseStartedDetailsType> {
        const { requestId, timeStamp } = details;

        const context = requestContextStorage.update(requestId, {
            state: RequestContextState.RESPONSE_STARTED,
            timestamp: timeStamp,
        });

        return { details, context };
    }

    private static handleOnCompleted(
        details: WebRequest.OnCompletedDetailsType,
    ): RequestData<WebRequest.OnCompletedDetailsType> {
        const { requestId, timeStamp } = details;

        const context = requestContextStorage.update(requestId, {
            state: RequestContextState.COMPLETED,
            timestamp: timeStamp,
        });

        return { details, context };
    }

    private static handleOnErrorOccurred(
        details: WebRequest.OnErrorOccurredDetailsType,
    ): RequestData<WebRequest.OnErrorOccurredDetailsType> {
        const { requestId, timeStamp } = details;

        const context = requestContextStorage.update(requestId, {
            state: RequestContextState.ERROR,
            timestamp: timeStamp,
        });

        return { details, context };
    }
}
