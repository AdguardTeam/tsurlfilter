import { Events, WebRequest } from 'webextension-polyfill';

import { RequestContext } from '../request-context-storage';

/**
 * Extended callback argument data
 */
export interface RequestData<Details> {
    details: Details,
    context?: RequestContext;
}

/**
 * Callback function passed as RequestEvent.addListener method argument
 */
export type RequestEventCallback<Details> = (
    requestData: RequestData<Details>
) => WebRequest.BlockingResponseOrPromise | void;


/**
 * Function registered as listener of the original event
 */
export type RequestEventListener<Details> = (
    details: Details
) => WebRequest.BlockingResponseOrPromise | void;

/**
 * Creates listener for original event from extended callback
 */
export type RequestEventListenerFactory<Details> = (
    callback: RequestEventCallback<Details>
) => RequestEventListener<Details>;


/**
 * Original lifecycle event of browser.webRequest
 */
export interface OriginalRequestEvent<Details, Options> 
    extends Events.Event<RequestEventListener<Details>>{
    addListener(
        callback: RequestEventListener<Details>,
        filter: WebRequest.RequestFilter,
        extraInfoSpec?: Options[]
    ): void;
}


export class RequestEvent<Details, Options> {
    private listenerFactory: RequestEventListenerFactory<Details>;

    private event: OriginalRequestEvent<Details, Options>;

    private listeners = new Map<RequestEventCallback<Details>, RequestEventListener<Details>>();

    constructor(
        event: OriginalRequestEvent<Details, Options>,
        listenerFactory: RequestEventListenerFactory<Details>,
    ){
        this.event = event;
        this.listenerFactory = listenerFactory;
    }

    public addListener(
        callback: RequestEventCallback<Details>,
        filter: WebRequest.RequestFilter,
        extraInfoSpec?: Options[],
    ): void {
        const listener = this.listenerFactory(callback);

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
