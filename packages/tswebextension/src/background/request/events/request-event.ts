import { WebRequest, Events } from 'webextension-polyfill';
import { RequestContext } from '../request-context-storage';

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
    public listeners: EventCallback<Details>[] = [];

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
            for (let i = 0; i < this.listeners.length; i++) {
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
