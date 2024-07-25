import type { WebRequest } from 'webextension-polyfill';
import type { MatchingResult, HTTPMethod, CosmeticResult } from '@adguard/tsurlfilter';

import type { ParsedCookie } from '../../../common/cookie-filtering/parsed-cookie';
import type { TabFrameRequestContext } from '../../tabs/tabs-api';
import { type ContentType } from '../../../common/request-type';

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

    /**
     * Script text to be injected.
     * It is precalculated onBeforeRequest and used later.
     */
    scriptText?: string,

    /**
     * CSS text to be injected.
     * It is precalculated onBeforeRequest and used later.
     */
    cssText?: string,
};

/**
 * Map of request context data.
 */
type RequestMap = Map<string, RequestContext>;

/**
 * Map of tab and frame id to request id.
 */
type TabAndFrameMap = Map<string, string>;

/**
 * Request context storage used to keep track of request data
 * and calculated rules for it.
 */
export class RequestContextStorage {
    /**
     * Map of request context data.
     */
    requestMap:RequestMap = new Map();

    /**
     * Map of tab and frame id to request id.
     * We use second map for faster search of context data when we have tab id and frame id only.
     */
    tabAndFrameMap:TabAndFrameMap = new Map();

    /**
     * Generates key based on tab id and frame id.
     * @param tabId Tab id.
     * @param frameId Frame id.
     * @returns Generated script key.
     */
    private static getTabAndFrameKey(tabId: number, frameId: number): string {
        return `${tabId}-${frameId}`;
    }

    /**
     * Sets requestData context by requestData id.
     * @param requestId Request id.
     * @param requestData Request context data.
     */
    public set(requestId: string, requestData: RequestContext): void {
        this.requestMap.set(requestId, requestData);
        const tabAndFrameKey = RequestContextStorage.getTabAndFrameKey(requestData.tabId, requestData.frameId);
        this.tabAndFrameMap.set(tabAndFrameKey, requestId);
    }

    /**
     * Updates request context fields. Can be done partially.
     * @param requestId Request id.
     * @param data Partial request context.
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
     * @param requestId Request id.
     * @returns Request context or undefined if request context not found.
     */
    public get(requestId: string): RequestContext | undefined {
        return this.requestMap.get(requestId);
    }

    /**
     * Returns request context by tab id and frame id.
     * @param tabId Tab id.
     * @param frameId Frame id.
     * @returns Request context or undefined if request context not found.
     */
    public getByTabAndFrame(tabId: number, frameId: number): RequestContext | undefined {
        const tabAndFrameKey = RequestContextStorage.getTabAndFrameKey(tabId, frameId);
        const requestId = this.tabAndFrameMap.get(tabAndFrameKey);
        if (!requestId) {
            return undefined;
        }
        return this.requestMap.get(requestId);
    }

    /**
     * Removes request context from the map by request id.
     * @param requestId Request id.
     */
    public delete(requestId: string): void {
        const requestContext = this.requestMap.get(requestId);
        if (requestContext) {
            const { tabId, frameId } = requestContext;
            const tabAndFrameKey = RequestContextStorage.getTabAndFrameKey(tabId, frameId);
            this.tabAndFrameMap.delete(tabAndFrameKey);
            this.requestMap.delete(requestId);
        }
    }

    /**
     * Clears all request context data.
     */
    public clear(): void {
        this.requestMap.clear();
        this.tabAndFrameMap.clear();
    }
}

export const requestContextStorage = new RequestContextStorage();
