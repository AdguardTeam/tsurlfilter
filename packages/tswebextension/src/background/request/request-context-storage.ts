import { MatchingResult, RequestType } from '@adguard/tsurlfilter';
import { ContentType } from './request-type';

/**
 * Request context data
 */
export interface RequestContext {
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

    public update(requestId: string, data: Partial<RequestContext>): void {
        const requestContext = this.contextStorage.get(requestId);
        if (requestContext) {
            this.contextStorage.set(requestId, Object.assign(requestContext, data));
        }

    }

    public delete(requestId: string): void {
        if (this.contextStorage.has(requestId)) {
            this.contextStorage.delete(requestId);
        }
    }
}

export const requestContextStorage = new RequestContextStorage();