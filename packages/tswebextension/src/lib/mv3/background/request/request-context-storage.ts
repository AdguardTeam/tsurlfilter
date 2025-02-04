import { type WebRequest } from 'webextension-polyfill';
import { type MatchingResult, type HTTPMethod } from '@adguard/tsurlfilter';

import { type ContentType } from '../../../common/request-type';
import { type ParsedCookie } from '../../../common/cookie-filtering/parsed-cookie';
import { type TabFrameRequestContextMV3 } from '../../tabs/tabs-api';

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
export type RequestContext = TabFrameRequestContextMV3 & {
    /**
     * During redirect processing, multiple events are processed in the same request lifecycle.
     * We need a unique identifier to separate these requests in the filtering log.
     *
     * @see https://developer.chrome.com/docs/extensions/reference/webRequest/#life-cycle-of-requests
     */
    eventId: string;

    state: RequestContextState;
    /**
     * Record time in ms.
     */
    timestamp: number;
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
};

/**
 * Map of request context data.
 */
type RequestMap = Map<string, RequestContext>;

/**
 * Request context storage used to keep track of request data
 * and calculated rules for it.
 */
export class RequestContextStorage {
    /**
     * Map of request context data.
     */
    requestMap: RequestMap = new Map();

    /**
     * Sets requestData context by requestData id.
     *
     * @param requestId Request id.
     * @param requestData Request context data.
     */
    public set(requestId: string, requestData: RequestContext): void {
        this.requestMap.set(requestId, requestData);
    }

    /**
     * Updates request context fields. Can be done partially.
     *
     * @param requestId Request id.
     * @param data Partial request context.
     *
     * @returns Updated request context or undefined if request context not found.
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
     * Returns request context by request id.
     *
     * @param requestId Request id.
     *
     * @returns Request context or undefined if request context not found.
     */
    public get(requestId: string): RequestContext | undefined {
        return this.requestMap.get(requestId);
    }

    /**
     * Removes non document/subdocument request context from the map by request id.
     *
     * @param requestId Request id.
     */
    public delete(requestId: string): void {
        const context = this.requestMap.get(requestId);
        if (!context) {
            return;
        }

        this.requestMap.delete(requestId);
    }

    /**
     * Clears all request context data.
     */
    public clear(): void {
        this.requestMap.clear();
    }
}

export const requestContextStorage = new RequestContextStorage();
