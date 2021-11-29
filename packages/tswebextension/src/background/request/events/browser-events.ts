import browser, { WebRequest, Events } from 'webextension-polyfill';
import { RequestType } from '@adguard/tsurlfilter';

import { RequestContext } from '../request-context-storage';
import { requestContextStorage } from '../request-context-storage';

const MAX_URL_LENGTH = 1024 * 16;

export namespace BrowserEvents {

    /**
     * Extended {@link RequestEventCallback}  argument data
     */
    export interface RequestData<Details> {
        details: Details,
        context?: RequestContext;
    }

    /**
     * Callback function passed as {@link RequestEvent} methods argument
     * 
     * This function passed to {@link RequestEvent.addListener},
     * {@link RequestEventListener} is dynamicly created by {@link CreateRequestEventListener} function
     * and registetered in the browser.WebRequest event
     * 
     */
    export type RequestEventCallback<Details> = (
        requestData: RequestData<Details>
    ) => WebRequest.BlockingResponseOrPromise | void;

    /**
     * Function registered as listener of the browser.WebRequest event
     * 
     * 1. Handles request details from original event
     * 2. modifies data in {@link RequestContext})
     * 3. Executes the {@link RequestEventCallback} passed 
     *    to {@link RequestEvent.addListener} with {@link RequestData}
     * 4. Returns callback result
     */
    export type RequestEventListener<Details> = (
        details: Details
    ) => WebRequest.BlockingResponseOrPromise | void;


    /**
     * Creates {@link RequestEventListener}, that
     * execute {@link RequestEventCallback} with {@link RequestData} argument
     */
    export type CreateRequestEventListener<Details> = (
        callback?: RequestEventCallback<Details>
    ) => RequestEventListener<Details>;

    /**
     * More flexible variant for {@link Events.Event} interface
     */
    export interface OriginalRequestEvent<Details, Options>
        extends Events.Event<RequestEventListener<Details>> {
        addListener(
            callback: RequestEventListener<Details>,
            filter: WebRequest.RequestFilter,
            extraInfoSpec?: Options[]
        ): void;
    }

    export interface RequestEventAddListenerProps<Details, Options> {
        filter: WebRequest.RequestFilter,
        extraInfoSpec?: Options[],
        callback?: RequestEventCallback<Details>,
    }

    /**
     * browser.webRequest generic event wrapper,
     * that register and unregister dynamicly created callbacks,
     * based on logic, described in {@link CreateRequestEventListener} and {@link RequestEventCallback}
     */
    export class RequestEvent<Details, Options> {

        private createListener: CreateRequestEventListener<Details>;

        private event: OriginalRequestEvent<Details, Options>;

        constructor(
            event: OriginalRequestEvent<Details, Options>,
            createListener: CreateRequestEventListener<Details>,
        ) {
            this.event = event;
            this.createListener = createListener;
        }

        public addListener({ 
            filter,
            extraInfoSpec,
            callback,
        }: RequestEventAddListenerProps<Details, Options>): () => void {
            const listener = this.createListener(callback);

            this.event.addListener(listener, filter, extraInfoSpec);

            return () => {
                this.event.removeListener(listener);
            };
        }
    }




    export type OnBeforeRequest = OriginalRequestEvent<
        WebRequest.OnBeforeRequestDetailsType,
        WebRequest.OnBeforeRequestOptions
    >;

    export const onBeforeRequest = new RequestEvent(
        browser.webRequest.onBeforeRequest as OnBeforeRequest,
        (callback) => (details) => {
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

            if (callback) {
                return callback({ details, context });
            };
        },
    );


    export type OnBeforeSendHeaders = OriginalRequestEvent<
        WebRequest.OnBeforeSendHeadersDetailsType,
        WebRequest.OnBeforeSendHeadersOptions
    >;

    export const onBeforeSendHeaders = new RequestEvent(
        browser.webRequest.onBeforeSendHeaders as OnBeforeSendHeaders,
        (callback) => {
            return (details) => {
                if (callback) {
                    return callback({ details });
                };
            };
        },
    );

    export type OnSendHeaders = OriginalRequestEvent<
        WebRequest.OnSendHeadersDetailsType,
        WebRequest.OnSendHeadersOptions
    >;

    export const onSendHeaders = new RequestEvent(
        browser.webRequest.onSendHeaders as OnSendHeaders,
        (callback) => {
            return (details) => {
                if (callback) {
                    return callback({ details });
                };
            };
        },
    );

    export type OnHeadersReceived = OriginalRequestEvent<
        WebRequest.OnHeadersReceivedDetailsType,
        WebRequest.OnHeadersReceivedOptions
    >;

    export const onHeadersReceived = new RequestEvent(
        browser.webRequest.onHeadersReceived as OnHeadersReceived,
        (callback) => {
            return (details) => {
                const { requestId } = details;
                const context = requestContextStorage.get(requestId);
                if (callback) {
                    return callback({ details, context });
                }
            };
        },
    );

    export type OnAuthRequired = OriginalRequestEvent<
        WebRequest.OnAuthRequiredDetailsType,
        WebRequest.OnAuthRequiredOptions
    >;

    export const onAuthRequired = new RequestEvent(
        browser.webRequest.onAuthRequired as OnAuthRequired,
        (callback) => (details) => {
            if (callback) {
                return callback({ details });
            }
        },
    );

    export type OnBeforeRedirect = OriginalRequestEvent<
        WebRequest.OnBeforeRedirectDetailsType,
        WebRequest.OnBeforeRedirectOptions
    >;

    export const onBeforeRedirect = new RequestEvent(
        browser.webRequest.onBeforeRedirect as OnBeforeRedirect,
        (callback) => (details) => {
            if (callback) {
                return callback({ details });
            }
        },
    );

    export type OnResponseStarted = OriginalRequestEvent<
        WebRequest.OnResponseStartedDetailsType,
        WebRequest.OnResponseStartedOptions
    >;

    export const onResponseStarted = new RequestEvent(
        browser.webRequest.onResponseStarted as OnResponseStarted,
        (callback) => {
            return (details) => {
                if (callback) {
                    return callback({ details });
                }
            };
        },
    );

    export type OnCompleted = OriginalRequestEvent<
        WebRequest.OnCompletedDetailsType,
        WebRequest.OnCompletedOptions
    >;

    export const onCompleted = new RequestEvent(
        browser.webRequest.onCompleted as OnCompleted,
        (callback) => {
            return (details) => {
                const { requestId } = details;
                const context = requestContextStorage.get(requestId);
                if (callback) {
                    return callback({ details, context });
                }
            };
        },
    );

    export type OnErrorOccurred = OriginalRequestEvent<
        WebRequest.OnErrorOccurredDetailsType,
        WebRequest.OnErrorOccurredOptions
    >;

    export const onErrorOccurred = new RequestEvent(
        browser.webRequest.onErrorOccurred as OnErrorOccurred,
        (callback) => {
            return (details) => {
                const { requestId } = details;
                const context = requestContextStorage.get(requestId);
                if (callback) {
                    return callback({ details, context });
                }
            };
        },
    );
}
