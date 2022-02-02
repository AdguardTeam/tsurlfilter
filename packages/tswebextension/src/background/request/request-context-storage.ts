import { WebRequest } from 'webextension-polyfill';
import { CosmeticRule, MatchingResult, RequestType } from '@adguard/tsurlfilter';
import { ContentType } from './request-type';
import ParsedCookie from '../services/cookie-filtering/parsed-cookie';
import { EventChannel, EventChannelInterface } from '../utils';

export const enum RequestContextState {
    BEFORE_REQUEST = 'BEFORE_REQUEST',
    BEFORE_SEND_HEADERS = 'BEFORE_SEND_HEADERS',
    SEND_HEADERS = 'SEND_HEADERS',
    HEADERS_RECEIVED = 'HEADERS_RECEIVED',
    AUTH_REQUIRED = 'AUTH_REQUIRED',
    BEFORE_REDIRECT = 'BEFORE_REDIRECT',
    RESPONSE_STARTED = 'RESPONSE_STARTED',
    COMPLETED = 'COMPLETED',
    ERROR = 'ERROR',
}

/**
 * Request context data
 */
export interface RequestContext {
    state: RequestContextState
    requestId: string

    tabId: number,
    frameId: number,
    timestamp: number // record time in ms

    requestUrl?: string
    referrerUrl?: string
    requestType?: RequestType
    contentType?: ContentType
    requestFrameId?: number
    thirdParty?: boolean
    responseHeaders?: WebRequest.HttpHeaders
    method?: string

    /**
     * filtering data from {@link EngineApi.matchRequest}
     */
    matchingResult?: MatchingResult | null
    statusCode?: number
    cookies?: ParsedCookie[]
    htmlRules?: CosmeticRule[]
    contentTypeHeader?: string
}
/**
 * Managing requests context api.
 * Each request has a {@link RequestContext} with unique key: requestId
 */
export interface RequestContextStorageInterface {
    /**
     * Get request by requestId
     */
    get: (requestId: string) => RequestContext | undefined;
    /**
     * Record request context. If context with passed id is exist, it will be overwritten
     */
    record: (requestId: string, data: RequestContext) => RequestContext;
    /**
     * Update request context fields
     */
    update: (requestId: string, data: Partial<RequestContext>) => void;
    /**
     * Delete request context
     */
    delete: (requestId: string) => void;
    /**
     * Clear context storage
     */
    clear: () => void;

    /**
     * find first request context matching specified url and request type
     */
    find: (
        requestUrl: string,
        requestType: RequestType
    ) =>  RequestContext | undefined

    onRecord: EventChannelInterface;

    onUpdate: EventChannelInterface;
}

export class RequestContextStorage implements RequestContextStorageInterface {
    protected contextStorage = new Map<string, RequestContext>();

    onRecord = new EventChannel();

    onUpdate = new EventChannel();

    public get(requestId: string): RequestContext | undefined {
        return this.contextStorage.get(requestId);
    }

    public record(requestId: string, data: RequestContext): RequestContext {
        this.contextStorage.set(requestId, data);
        this.onRecord.dispatch(requestId, data);
        return data;
    }

    public update(requestId: string, data: Partial<RequestContext>): RequestContext | undefined {
        const requestContext = this.contextStorage.get(requestId);

        if (requestContext) {
            const newData = Object.assign(requestContext, data);
            this.contextStorage.set(requestId, newData);
            this.onUpdate.dispatch(requestId, newData);
            return newData;
        } else {
            this.contextStorage.set(requestId, data as RequestContext);
            this.onUpdate.dispatch(requestId, data);
        }

    }

    public delete(requestId: string): void {
        if (this.contextStorage.has(requestId)) {
            this.contextStorage.delete(requestId);
        }
    }

    public find(requestUrl: string, requestType: RequestType): RequestContext | undefined {
        for (const context of this.contextStorage.values()) {
            if (
                context.requestUrl === requestUrl &&
                context.requestType === requestType
            ) {
                return context;
            }
        }
    }

    public clear(): void {
        this.contextStorage.clear();
    }
}

export const requestContextStorage = new RequestContextStorage();
