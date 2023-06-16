import browser, { WebRequest } from 'webextension-polyfill';
import { RequestType } from '@adguard/tsurlfilter/es/request-type';
import { HTTPMethod } from '@adguard/tsurlfilter';

import { requestContextStorage, RequestContextState, RequestContext } from '../request-context-storage';
import { RequestEvent, RequestData } from './request-event';
import { isThirdPartyRequest, getRequestType, isHttpRequest } from '../../../../common';
import { MAIN_FRAME_ID, TabFrameRequestContext } from '../../tabs';
import { tabsApi } from '../../api';

const MAX_URL_LENGTH = 1024 * 16;

type ChromiumBrowser = typeof browser & {
    webRequest: {
        OnHeadersReceivedOptions: unknown
        OnBeforeSendHeadersOptions: unknown
    }
};

/**
 * Request events class.
 */
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

    /**
     * Initializes request events service.
     */
    public static init(): void {
        RequestEvents.onBeforeRequest.init(
            browser.webRequest.onBeforeRequest,
            RequestEvents.handleOnBeforeRequest,
            { urls: ['<all_urls>'] },
            ['blocking', 'requestBody'],
        );

        const onBeforeSendHeadersOptions: WebRequest.OnBeforeSendHeadersOptions[] = ['requestHeaders', 'blocking'];

        const onBeforeSendHeadersOptionTypes = (browser as ChromiumBrowser).webRequest.OnBeforeSendHeadersOptions;

        if (typeof onBeforeSendHeadersOptionTypes !== 'undefined'
            && Object.prototype.hasOwnProperty.call(onBeforeSendHeadersOptionTypes, 'EXTRA_HEADERS')) {
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

        const onHeadersReceivedOptionTypes = (browser as ChromiumBrowser).webRequest.OnHeadersReceivedOptions;

        if (typeof onHeadersReceivedOptionTypes !== 'undefined'
            && Object.prototype.hasOwnProperty.call(onBeforeSendHeadersOptionTypes, 'EXTRA_HEADERS')) {
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

    /**
     * Handles onBeforeRequest event.
     *
     * @param details WebRequest details.
     * @returns Request data.
     */
    private static handleOnBeforeRequest(
        details: WebRequest.OnBeforeRequestDetailsType,
    ): RequestData<WebRequest.OnBeforeRequestDetailsType> {
        const {
            requestId,
            type,
            tabId,
            parentFrameId,
            originUrl,
            initiator,
            method,
            timeStamp,
        } = details;

        let { url, frameId } = details;

        /**
         * Truncate too long urls.
         *
         * @see {@link https://github.com/AdguardTeam/AdguardBrowserExtension/issues/1493}
         */
        if (url.length > MAX_URL_LENGTH) {
            url = url.slice(0, MAX_URL_LENGTH);
        }

        /**
         * FF sends http instead of ws protocol at the http-listeners layer
         * Although this is expected, as the Upgrade request is indeed an HTTP request,
         * we use a chromium based approach in this case.
         */
        if (type === 'websocket' && isHttpRequest(url)) {
            url = url.replace(/^http(s)?:/, 'ws$1:');
        }

        const { requestType, contentType } = getRequestType(type);

        const isDocumentRequest = requestType === RequestType.Document;

        // Pre-rendered documents can have a frame ID other than zero
        frameId = isDocumentRequest ? MAIN_FRAME_ID : details.frameId;

        let requestFrameId = isDocumentRequest ? frameId : parentFrameId;

        // Relate request to main_frame
        if (requestFrameId === -1) {
            requestFrameId = 0;
        }

        // To mark requests started via navigation from the address bar (real
        // request or pre-render, it does not matter) as first-party requests,
        // we get only part of the request context to record only the tab and
        // frame information before calculating the request referrer.
        const tabFrameRequestContext: TabFrameRequestContext = {
            requestUrl: url,
            requestType,
            requestId,
            frameId,
            tabId,
        };

        if (isDocumentRequest || requestType === RequestType.SubDocument) {
            // Saves the current tab url to retrieve it correctly below.
            tabsApi.handleFrameRequest(tabFrameRequestContext);
        }

        const referrerUrl = originUrl
            || initiator
            // Comparison of the requested url with the tab frame url in case of
            // a navigation change from the browser address bar.
            || tabsApi.getTabMainFrame(tabId)?.url
            || tabsApi.getTabFrame(tabId, requestFrameId)?.url
            || url;

        // Retrieve the rest part of the request context for record all fields.
        const requestContext: RequestContext = {
            ...tabFrameRequestContext,
            requestFrameId,
            state: RequestContextState.BeforeRequest,
            timestamp: timeStamp,
            thirdParty: isThirdPartyRequest(url, referrerUrl),
            referrerUrl,
            contentType,
            method: method as HTTPMethod,
        };

        requestContextStorage.set(requestId, requestContext);

        return { details, context: requestContext };
    }

    /**
     * Handles onBeforeSendHeaders event.
     *
     * @param details WebRequest details.
     * @returns Request data.
     */
    private static handleOnBeforeSendHeaders(
        details: WebRequest.OnBeforeSendHeadersDetailsType,
    ): RequestData<WebRequest.OnBeforeSendHeadersDetailsType> {
        const { requestId, timeStamp, requestHeaders } = details;

        const context = requestContextStorage.update(requestId, {
            state: RequestContextState.BeforeSendHeaders,
            timestamp: timeStamp,
            requestHeaders,
        });

        return { details, context };
    }

    /**
     * Handles onSendHeaders event.
     *
     * @param details WebRequest details.
     * @returns Request data with context.
     */
    private static handleSendHeaders(
        details: WebRequest.OnSendHeadersDetailsType,
    ): RequestData<WebRequest.OnSendHeadersDetailsType> {
        const { requestId, timeStamp } = details;

        const context = requestContextStorage.update(requestId, {
            state: RequestContextState.SendHeaders,
            timestamp: timeStamp,
        });

        return { details, context };
    }

    /**
     * Handles onHeadersReceived event.
     *
     * @param details WebRequest details.
     * @returns Request data with context.
     */
    private static handleOnHeadersReceived(
        details: WebRequest.OnHeadersReceivedDetailsType,
    ): RequestData<WebRequest.OnHeadersReceivedDetailsType> {
        const {
            requestId,
            responseHeaders,
            statusCode,
        } = details;

        const context = requestContextStorage.update(requestId, {
            state: RequestContextState.HeadersReceived,
            responseHeaders,
            statusCode,
        });

        return { details, context };
    }

    /**
     * Handles onAuthRequired event.
     *
     * @param details WebRequest details.
     * @returns Request data with context.
     */
    private static handleOnAuthRequired(
        details: WebRequest.OnAuthRequiredDetailsType,
    ): RequestData<WebRequest.OnAuthRequiredDetailsType> {
        const { requestId, timeStamp } = details;

        const context = requestContextStorage.update(requestId, {
            state: RequestContextState.AuthRequired,
            timestamp: timeStamp,
        });

        return { details, context };
    }

    /**
     * Handles onBeforeRedirect event.
     *
     * @param details WebRequest details.
     * @returns Request data with context.
     */
    private static handleOnBeforeRedirect(
        details: WebRequest.OnBeforeRedirectDetailsType,
    ): RequestData<WebRequest.OnBeforeRedirectDetailsType> {
        const { requestId, timeStamp } = details;

        const context = requestContextStorage.update(requestId, {
            state: RequestContextState.BeforeRedirect,
            timestamp: timeStamp,
        });

        return { details, context };
    }

    /**
     * Handles onResponseStarted event.
     *
     * @param details WebRequest details.
     * @returns Request data with context.
     */
    private static handleOnResponseStarted(
        details: WebRequest.OnResponseStartedDetailsType,
    ): RequestData<WebRequest.OnResponseStartedDetailsType> {
        const { requestId, timeStamp } = details;

        const context = requestContextStorage.update(requestId, {
            state: RequestContextState.ResponseStarted,
            timestamp: timeStamp,
        });

        return { details, context };
    }

    /**
     * Handles onCompleted event.
     *
     * @param details WebRequest details.
     * @returns Request data with context.
     */
    private static handleOnCompleted(
        details: WebRequest.OnCompletedDetailsType,
    ): RequestData<WebRequest.OnCompletedDetailsType> {
        const { requestId, timeStamp } = details;

        const context = requestContextStorage.update(requestId, {
            state: RequestContextState.Completed,
            timestamp: timeStamp,
        });

        return { details, context };
    }

    /**
     * Handles onErrorOccurred event.
     *
     * @param details WebRequest details.
     * @returns Request data with context.
     */
    private static handleOnErrorOccurred(
        details: WebRequest.OnErrorOccurredDetailsType,
    ): RequestData<WebRequest.OnErrorOccurredDetailsType> {
        const { requestId, timeStamp } = details;

        const context = requestContextStorage.update(requestId, {
            state: RequestContextState.Error,
            timestamp: timeStamp,
        });

        return { details, context };
    }
}
