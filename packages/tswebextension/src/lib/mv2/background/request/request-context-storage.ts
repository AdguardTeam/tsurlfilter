import { WebRequest } from 'webextension-polyfill';
import type {
    CosmeticResult,
    MatchingResult,
    RequestType,
} from '@adguard/tsurlfilter';
import ParsedCookie from '../services/cookie-filtering/parsed-cookie';
import { EventChannel, EventChannelInterface, ContentType } from '../../../common';
import { TabFrameRequestContext } from '../tabs/tabs-api';

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
    requestFrameId: number;
    thirdParty: boolean;
    method: string;

    requestHeaders?: WebRequest.HttpHeaders;
    responseHeaders?: WebRequest.HttpHeaders;
    statusCode?: number;
    cookies?: ParsedCookie[];
    contentTypeHeader?: string;

    /**
     * Filtering data from {@link EngineApi.matchRequest}.
     */
    matchingResult?: MatchingResult | null;

    /**
     * Filtering data from {@link EngineApi.getCosmeticResult}.
     */
    cosmeticResult?: CosmeticResult
};

/**
 * Managing requests context api.
 * Each request has a {@link RequestContext} with unique key: requestId.
 */
export type RequestStorageEvent = {
    id: string;
    data: RequestContext;
};

export interface RequestContextStorageInterface {
    /**
     * Get request by requestId.
     */
    get: (requestId: string) => RequestContext | undefined;

    /**
     * Record request context. If context with passed id is exist, it will be overwritten.
     */
    record: (requestId: string, data: RequestContext) => RequestContext;

    /**
     * Update request context fields.
     */
    update: (requestId: string, data: Partial<RequestContext>) => void;

    /**
     * Delete request context.
     */
    delete: (requestId: string) => void;

    /**
     * Clear context storage.
     */
    clear: () => void;

    /**
     * Find first request context matching specified url and request type.
     */
    find: (requestUrl: string, requestType: RequestType) => RequestContext | undefined;

    // TODO: Check usage of these two event channels
    onRecord: EventChannelInterface<RequestStorageEvent>;

    onUpdate: EventChannelInterface<RequestStorageEvent>;
}

/**
 * Implementation of the request context storage.
 */
export class RequestContextStorage implements RequestContextStorageInterface {
    protected contextStorage = new Map<string, RequestContext>();

    onRecord = new EventChannel<RequestStorageEvent>();

    onUpdate = new EventChannel<RequestStorageEvent>();

    /**
     * Get request by requestId.
     *
     * @param requestId Request id.
     * @returns Request context.
     */
    public get(requestId: string): RequestContext | undefined {
        return this.contextStorage.get(requestId);
    }

    /**
     * Record request context. And dispatch event.
     *
     * @param requestId Request id.
     * @param data Request context.
     * @returns Request context.
     */
    public record(requestId: string, data: RequestContext): RequestContext {
        this.contextStorage.set(requestId, data);
        this.onRecord.dispatch({
            id: requestId,
            data,
        });
        return data;
    }

    /**
     * Update request context fields. Can be done partially.
     *
     * @param requestId Request id.
     * @param data Partial request context.
     * @returns Updated request context.
     */
    public update(requestId: string, data: Partial<RequestContext>): RequestContext | undefined {
        const requestContext = this.contextStorage.get(requestId);

        if (requestContext) {
            const newData = Object.assign(requestContext, data);
            this.contextStorage.set(requestId, newData);
            this.onUpdate.dispatch({
                id: requestId,
                data: newData,
            });
            return newData;
        }
        this.contextStorage.set(requestId, data as RequestContext);
        this.onUpdate.dispatch({
            id: requestId,
            data: data as RequestContext,
        });
        return undefined;
    }

    /**
     * Removes request context from storage.
     *
     * @param requestId Request id.
     */
    public delete(requestId: string): void {
        if (this.contextStorage.has(requestId)) {
            this.contextStorage.delete(requestId);
        }
    }

    /**
     * Search for the request context by url and request type.
     *
     * @param requestUrl Request url.
     * @param requestType Request type.
     * @returns Request context or undefined.
     */
    public find(requestUrl: string, requestType: RequestType): RequestContext | undefined {
        for (const context of this.contextStorage.values()) {
            if (context.requestUrl === requestUrl && context.requestType === requestType) {
                return context;
            }
        }
        return undefined;
    }

    /**
     * Clear context storage.
     */
    public clear(): void {
        this.contextStorage.clear();
    }
}

export const requestContextStorage = new RequestContextStorage();
