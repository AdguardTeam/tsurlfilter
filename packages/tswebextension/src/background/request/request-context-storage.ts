import { CosmeticRule, MatchingResult, RequestType } from '@adguard/tsurlfilter';
import { ContentType } from './request-type';
import ParsedCookie from '../services/cookie-filtering/parsed-cookie';

/**
 * Request context data
 */
export interface RequestContext {
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

}

export class RequestContextStorage implements RequestContextStorageInterface {
    private contextStorage = new Map<string, RequestContext>();

    public get(requestId: string): RequestContext | undefined {
        return this.contextStorage.get(requestId);
    }

    public record(requestId: string, data: RequestContext): RequestContext {
        this.contextStorage.set(requestId, data);
        return data;
    }

    public update(requestId: string, data: Partial<RequestContext>): RequestContext | undefined {
        const requestContext = this.contextStorage.get(requestId);

        if (requestContext) {
            const newData = Object.assign(requestContext, data);
            this.contextStorage.set(requestId, newData);
            return newData;
        }

    }

    public delete(requestId: string): void {
        if (this.contextStorage.has(requestId)) {
            this.contextStorage.delete(requestId);
        }
    }
}

export const requestContextStorage = new RequestContextStorage();
