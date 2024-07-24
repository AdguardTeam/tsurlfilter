import type { WebRequest } from 'webextension-polyfill';
import type { MatchingResult, HTTPMethod, CosmeticResult } from '@adguard/tsurlfilter';

import type { ContentType } from '../../../common';
import type { ParsedCookie } from '../../../common/cookie-filtering/parsed-cookie';
import type { TabFrameRequestContext } from '../../tabs/tabs-api';

export const enum RequestContextState {
    BeforeRequest = 'beforeRequest',
    BeforeSendHeaders = 'beforeSendHeaders',
    SendHeaders = 'sendHeaders',
    HeadersReceived = 'headersReceived',
    AuthRequired = 'authRequired',
    BeforeRedirect = 'beforeRedirect',
    ResponseStarted = 'responseStarted',
    Completed = 'completed',
    Error = 'error',
}

/**
 * Request context data.
 */
export type RequestContext = TabFrameRequestContext & {
    state: RequestContextState;
    timestamp: number; // record time in ms
    referrerUrl: string;
    contentType: ContentType;
    thirdParty: boolean;
    method: HTTPMethod;

    requestHeaders?: WebRequest.HttpHeaders;
    responseHeaders?: WebRequest.HttpHeaders;
    cookies?: ParsedCookie[];

    /**
     * Filtering data from {@link EngineApi.matchRequest}.
     */
    matchingResult?: MatchingResult | null;

    /**
     * Filtering data from {@link EngineApi.getCosmeticResult}.
     */
    cosmeticResult?: CosmeticResult;

    // FIXME document
    scriptText?: string,

    // FIXME document
    cssText?: string,
};

/**
 *
 */
export class RequestContextStorage {
    requestMap = new Map();

    tabAndFrameMap = new Map();

    /**
     *
     * @param tabId
     * @param frameId
     */
    private getTabAndFrameKey(tabId: number, frameId: number): string {
        return `${tabId}-${frameId}`;
    }

    /**
     *
     * @param requestId
     * @param data
     */
    public set(requestId: string, data: RequestContext): void {
        this.requestMap.set(requestId, data);
        this.tabAndFrameMap.set(this.getTabAndFrameKey(data.tabId, data.frameId), requestId);
    }

    /**
     *
     * @param requestId
     * @param data
     */
    public update(requestId: string, data: Partial<RequestContext>): RequestContext | undefined {
        const requestContext = this.requestMap.get(requestId);

        if (requestContext) {
            Object.assign(requestContext, data);
            return requestContext;
        }

        return undefined;
    }

    /**
     *
     * @param requestId
     */
    public get(requestId: string): RequestContext | undefined {
        return this.requestMap.get(requestId);
    }

    /**
     *
     * @param tabId
     * @param frameId
     */
    public getByTabAndFrame(tabId: number, frameId: number): RequestContext | undefined {
        const tabAndFrameKey = this.getTabAndFrameKey(tabId, frameId);
        const requestId = this.tabAndFrameMap.get(tabAndFrameKey);
        return this.requestMap.get(requestId);
    }

    /**
     *
     * @param requestId
     */
    public delete(requestId: string): void {
        this.requestMap.delete(requestId);
    }

    /**
     *
     */
    public clear(): void {
        this.requestMap.clear();
    }
}

// /**
//  * Implementation of the request context storage.
//  *
//  * TODO: Add persistent storage for cases of deaths service worker.
//  */
// export class RequestContextStorage extends Map<string, RequestContext> {
//     /**
//      * Create new request context.
//      *
//      * @param requestId Request id.
//      * @param data Request context with a omitted eventId field. It is automatically generated.
//      * @returns Request context storage instance.
//      */
//     public create(requestId: string, data: RequestContext): RequestContext {
//         super.set(requestId, data);
//
//         return data;
//     }
//
//     /**
//      * Update request context fields. Can be done partially.
//      *
//      * @param requestId Request id.
//      * @param data Partial request context.
//      * @returns Updated request context.
//      */
//     public update(requestId: string, data: Partial<RequestContext>): RequestContext | undefined {
//         const requestContext = super.get(requestId);
//
//         if (requestContext) {
//             Object.assign(requestContext, data);
//             return requestContext;
//         }
//
//         // TODO: Throws error if request context not found after RequestEvents refactoring.
//         super.set(requestId, data as RequestContext);
//         return undefined;
//     }
// }

export const requestContextStorage = new RequestContextStorage();
