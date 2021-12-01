import browser, { WebRequest, Events } from 'webextension-polyfill';

import { RequestContext } from '../request-context-storage';
import { requestContextStorage } from '../request-context-storage';

/**
 * Extended {@link EventCallback} argument data
 */
export interface RequestData<Details> {
    details: Details,
    context?: RequestContext;
}

export type DetailsHandler<Details> = (
    details: Details
) => RequestData<Details>;

/**
 * Callback function passed as {@link RequestEvent} methods argument
 * 
 */
export type EventCallback<Details> = (
    requestData: RequestData<Details>
) => WebRequest.BlockingResponseOrPromise | void;

/**
 * Function registered as listener of the browser.WebRequest event
 */
export type BrowserEventListener<Details> = (
    details: Details
) => WebRequest.BlockingResponseOrPromise | void;

/**
 * More flexible variants for {@link Events.Event} interfaces
 */
export interface BrowserRequstEvent<Details, Options>
    extends Events.Event<BrowserEventListener<Details>> {
    addListener(
        callback: BrowserEventListener<Details>,
        filter: WebRequest.RequestFilter,
        extraInfoSpec?: Options[]
    ): void;
}

/**
 * browser.webRequest generic wrapper with custom event implementation
 */
export class RequestEvent<Details, Options> {
    private listeners: EventCallback<Details>[] = [];

    constructor(
        event: BrowserRequstEvent<Details, Options>,
        handler: DetailsHandler<Details>,
        filter: WebRequest.RequestFilter,
        extraInfoSpec?: Options[],
    ) {
        const handleBrowserEvent = (details: Details) => {
            const data = handler(details);

            /**
             * Execute all registered listeners one by one until a non-empty value is returned
             */
            for (let i = 0; this.listeners.length; i++) {
                const res = this.listeners[i](data);
                if (res) {
                    return res;
                }
            }
        };

        event.addListener(handleBrowserEvent, filter, extraInfoSpec);
    }

    public addListener(listener: EventCallback<Details>) {
        this.listeners.push(listener);
    }

    public removeListener(listener: EventCallback<Details>) {
        const index = this.listeners.indexOf(listener);

        if (index !== -1) {
            this.listeners.splice(index, 1);
        }
    }
}



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



const getContext = <T extends { requestId: string }>(details: T) => {
    const { requestId } = details;
    const context = requestContextStorage.get(requestId);
    return { details, context };
};


export type OnBeforeSendHeaders = BrowserRequstEvent<
WebRequest.OnBeforeSendHeadersDetailsType,
WebRequest.OnBeforeSendHeadersOptions
>;

export const onBeforeSendHeaders = new RequestEvent(
    browser.webRequest.onBeforeSendHeaders as OnBeforeSendHeaders,
    (details) => ({ details }),
    { urls: ['<all_urls>'] },
);

export type OnSendHeaders = BrowserRequstEvent<
WebRequest.OnSendHeadersDetailsType,
WebRequest.OnSendHeadersOptions
>;

export const onSendHeaders = new RequestEvent(
    browser.webRequest.onSendHeaders as OnSendHeaders,
    getContext,
    { urls: ['<all_urls>'] },
);

export type OnHeadersReceived = BrowserRequstEvent<
WebRequest.OnHeadersReceivedDetailsType,
WebRequest.OnHeadersReceivedOptions
>;

export const onHeadersReceived = new RequestEvent(
    browser.webRequest.onHeadersReceived as OnHeadersReceived,
    getContext,
    { urls: ['<all_urls>'] },
    ['responseHeaders', 'blocking'],
);

export type OnAuthRequired = BrowserRequstEvent<
WebRequest.OnAuthRequiredDetailsType,
WebRequest.OnAuthRequiredOptions
>;

export const onAuthRequired = new RequestEvent(
    browser.webRequest.onAuthRequired as OnAuthRequired,
    getContext,
    { urls: ['<all_urls>'] },
);

export type OnBeforeRedirect = BrowserRequstEvent<
WebRequest.OnBeforeRedirectDetailsType,
WebRequest.OnBeforeRedirectOptions
>;

export const onBeforeRedirect = new RequestEvent(
    browser.webRequest.onBeforeRedirect as OnBeforeRedirect,
    getContext,
    { urls: ['<all_urls>'] },
);

export type OnResponseStarted = BrowserRequstEvent<
WebRequest.OnResponseStartedDetailsType,
WebRequest.OnResponseStartedOptions
>;

export const onResponseStarted = new RequestEvent(
    browser.webRequest.onResponseStarted as OnResponseStarted,
    getContext,
    { urls: ['<all_urls>'] },
);

export type OnCompleted = BrowserRequstEvent<
WebRequest.OnCompletedDetailsType,
WebRequest.OnCompletedOptions
>;

export const onCompleted = new RequestEvent(
    browser.webRequest.onCompleted as OnCompleted,
    getContext,
    { urls: ['<all_urls>'] },
    ['responseHeaders'],
);

export type OnErrorOccurred = BrowserRequstEvent<
WebRequest.OnErrorOccurredDetailsType,
WebRequest.OnErrorOccurredOptions
>;

export const onErrorOccurred = new RequestEvent(
    browser.webRequest.onErrorOccurred as OnErrorOccurred,
    getContext,
    { urls: ['<all_urls>'] },
);
