import { type WebRequest, type Events } from 'webextension-polyfill';

import { type RequestContext } from '../request-context-storage';

/**
 * Extended {@link EventCallback} argument data.
 */
export interface RequestData<Details> {
    details: Details;
    context?: RequestContext;
}

/**
 * Handler for the {@link RequestEvent} methods.
 *
 * @param details Details of the request.
 *
 * @returns Request data.
 */
export type DetailsHandler<Details> = (
    details: Details
) => RequestData<Details>;

/**
 * Callback function passed as {@link RequestEvent} methods argument.
 *
 */
export type EventCallback<Details> = (
    requestData: RequestData<Details>
) => WebRequest.BlockingResponseOrPromise | void;

/**
 * Function registered as listener of the browser.WebRequest event.
 */
export type BrowserEventListener<Details> = (
    details: Details
) => WebRequest.BlockingResponseOrPromise | void;

/**
 * More flexible variants for {@link Events.Event} interfaces.
 */
export interface BrowserRequestEvent<Details, Options>
    extends Events.Event<BrowserEventListener<Details>> {
    addListener(
        callback: BrowserEventListener<Details>,
        filter: WebRequest.RequestFilter,
        extraInfoSpec?: Options[]
    ): void;
}

/**
 * Generic wrapper for browser.webRequest with custom event implementation.
 */
export class RequestEvent<Details, Options> {
    public listeners: EventCallback<Details>[] = [];

    /**
     * Register listener for the browser.webRequest events.
     *
     * @param event WebRequest event name.
     * @param handler Handler to register.
     * @param filter Filter of the events.
     * @param extraInfoSpec Extra info spec.
     */
    init(
        event: BrowserRequestEvent<Details, Options>,
        handler: DetailsHandler<Details>,
        filter: WebRequest.RequestFilter,
        extraInfoSpec?: Options[],
    ): void {
        const handleBrowserEvent = (details: Details): void | WebRequest.BlockingResponseOrPromise => {
            const data = handler(details);

            /**
             * Execute all registered listeners one by one until a non-empty value is returned.
             */
            for (let i = 0; i < this.listeners.length; i += 1) {
                const res = this.listeners[i](data);
                if (res) {
                    return res;
                }
            }

            return undefined;
        };

        if (extraInfoSpec) {
            event.addListener(handleBrowserEvent, filter, extraInfoSpec);
        } else {
            event.addListener(handleBrowserEvent, filter);
        }
    }

    /**
     * Register listener for the browser.webRequest events.
     *
     * @param listener Event callback.
     */
    public addListener(listener: EventCallback<Details>): void {
        this.listeners.push(listener);
    }

    /**
     * Remove listener from the browser.webRequest events.
     *
     * @param listener Event callback.
     */
    public removeListener(listener: EventCallback<Details>): void {
        const index = this.listeners.indexOf(listener);

        if (index !== -1) {
            this.listeners.splice(index, 1);
        }
    }
}
