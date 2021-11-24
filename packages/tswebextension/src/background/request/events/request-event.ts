import { Events, WebRequest } from 'webextension-polyfill';

import { RequestContext } from '../request-context-storage';

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
 * If the function passed to {@link RequestEvent.addListener},
 * {@link RequestEventListener} is dynamicly created by {@link CreateRequestEventListener} function,
 * mapped with callback and registetered in the browser.WebRequest event
 * 
 * If the fucntion is passed to {@link RequestEvent.removeListener},
 * mapped {@link RequestEventListener} unsubscribes from the browser.WebRequest event
 * 
 */
export type RequestEventCallback<Details> = (
    requestData: RequestData<Details>
) => WebRequest.BlockingResponseOrPromise | void;


/**
 * Function registered as listener of the browser.WebRequest event
 * 
 * 1. Handles request details from original event
 * 2. Does some preprocessing (Reads/Writes data from {@link RequestContext})
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
    callback: RequestEventCallback<Details>
) => RequestEventListener<Details>;


/**
 * More flexible variant for {@link Events.Event} interface
 */
export interface OriginalRequestEvent<Details, Options> 
    extends Events.Event<RequestEventListener<Details>>{
    addListener(
        callback: RequestEventListener<Details>,
        filter: WebRequest.RequestFilter,
        extraInfoSpec?: Options[]
    ): void;
}

/**
 * browser.webRequest generic event wrapper,
 * that register and unregister dynamicly created callbacks,
 * based on preprocess logic, described in {@link CreateRequestEventListener}
 * and logic of {@link RequestEventCallback} passed as class methods argument
 * 
 * The class use same {@link Events.Event} interface for maximum compatibility with original api
 */
export class RequestEvent<Details, Options> {
    private createListener: CreateRequestEventListener<Details>;

    private event: OriginalRequestEvent<Details, Options>;

    private listeners = new Map<RequestEventCallback<Details>, RequestEventListener<Details>>();

    constructor(
        event: OriginalRequestEvent<Details, Options>,
        createListener: CreateRequestEventListener<Details>,
    ){
        this.event = event;
        this.createListener = createListener;
    }

    public addListener(
        callback: RequestEventCallback<Details>,
        filter: WebRequest.RequestFilter,
        extraInfoSpec?: Options[],
    ): void {
        const listener = this.createListener(callback);

        this.listeners.set(callback, listener);

        this.event.addListener(listener, filter, extraInfoSpec);
    }

    removeListener(callback: RequestEventCallback<Details>): void{
        const listener = this.listeners.get(callback);
        if (listener){
            this.event.removeListener(listener);
            this.listeners.delete(callback);
        }
       
    }

    hasListener(callback: RequestEventCallback<Details>): boolean {
        const listener = this.listeners.get(callback);
        if (listener){
            return this.event.hasListener(listener);
        }
        return false;
   
    }

    hasListeners(): boolean{
        return this.event.hasListeners();
    }
}
