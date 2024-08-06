import type { WebRequest } from 'webextension-polyfill';
import {
    type MatchingResult,
    type HTTPMethod,
    type CosmeticResult,
    RequestType,
} from '@adguard/tsurlfilter';

import type { ContentType } from '../../../common/request-type';
import type { ParsedCookie } from '../../../common/cookie-filtering/parsed-cookie';
import type { TabFrameRequestContext } from '../../tabs/tabs-api';
import { BACKGROUND_TAB_ID, FRAME_DELETION_TIMEOUT_MS, isHttpOrWsRequest } from '../../../common';

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
 * Map of tab and frame id to request ids.
 * Sometimes we can have several request ids, for example, in cases where
 * tab id and frame id information was not removed yet, but a new onBeforeRequestEvent fired.
 */
type TabAndFrameMap = Map<string, string[]>;

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
     * Map of tab and frame id to request id.
     * We use the second map for faster search of context data when we have tab id and frame id only.
     * Sometimes we can have several request ids, for example, in cases where
     * the tab id and frame id information was not removed yet, but a new onBeforeRequestEvent fired.
     */
    tabAndFrameMap: TabAndFrameMap = new Map();

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

        /**
         * We store tab and frame id to request id mapping only for document and subdocument requests.
         * Otherwise, there might be other requests that can rewrite this mapping with unrelated data.
         * For example, a request for a script or image might have the same tab and frame id too.
         */
        if (RequestContextStorage.isForegroundDocumentRequest(requestData)) {
            const tabAndFrameKey = RequestContextStorage.getTabAndFrameKey(requestData.tabId, requestData.frameId);

            /**
             * We store request ids in the array, because there might be cases when we have different
             * requests with the same tab and frame id.
             * For example when page was reloaded by user faster than the frame deletion
             * timeout fires {@link FRAME_DELETION_TIMEOUT_MS}.
             */
            const requestIds = this.tabAndFrameMap.get(tabAndFrameKey) || [];
            requestIds.push(requestId);
            this.tabAndFrameMap.set(tabAndFrameKey, requestIds);
        }
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
        const requestIds = this.tabAndFrameMap.get(tabAndFrameKey);
        if (!requestIds || requestIds.length === 0) {
            return undefined;
        }
        const lastRequestId = requestIds[requestIds.length - 1];
        return this.requestMap.get(lastRequestId);
    }

    /**
     * Removes non document/subdocument request context from the map by request id.
     * @param requestId Request id.
     */
    public delete(requestId: string): void {
        const context = this.requestMap.get(requestId);
        if (!context) {
            return;
        }

        /**
         * Document and subdocument requests are deleted by the deleteByTabAndFrame method.
         */
        if (!RequestContextStorage.isForegroundDocumentRequest(context)) {
            this.requestMap.delete(requestId);
        }
    }

    /**
     * Checks if request type is document or subdocument and is not from a background tab with tabId === -1.
     * @param requestContext Request context.
     * @returns True if request type is document or subdocument and is not from a background tab.
     */
    private static isForegroundDocumentRequest(requestContext: RequestContext): boolean {
        const isBackgroundTab = requestContext.tabId === BACKGROUND_TAB_ID;
        const isDocumentOrSubDocument = requestContext.requestType === RequestType.Document
            || requestContext.requestType === RequestType.SubDocument;
        return !isBackgroundTab && isDocumentOrSubDocument && isHttpOrWsRequest(requestContext.requestUrl);
    }

    /**
     * Removes request context from the map by tab id and frame id.
     * @param tabId Tab id.
     * @param frameId Frame id.
     */
    public deleteByTabAndFrame(tabId: number, frameId: number): void {
        const tabAndFrameKey = RequestContextStorage.getTabAndFrameKey(tabId, frameId);
        const requestIds = this.tabAndFrameMap.get(tabAndFrameKey);
        if (requestIds) {
            const currentTime = Date.now();
            const filteredRequestIds = requestIds.filter((requestId) => {
                const requestContext = this.requestMap.get(requestId);
                if (requestContext && currentTime - requestContext.timestamp > FRAME_DELETION_TIMEOUT_MS) {
                    this.requestMap.delete(requestId);
                    return false;
                }
                return requestContext !== undefined;
            });

            if (filteredRequestIds.length > 0) {
                this.tabAndFrameMap.set(tabAndFrameKey, filteredRequestIds);
            } else {
                this.tabAndFrameMap.delete(tabAndFrameKey);
            }
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
