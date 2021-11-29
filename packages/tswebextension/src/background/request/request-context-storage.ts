import { MatchingResult, RequestType } from '@adguard/tsurlfilter';
import { ContentType } from './request-type';

export interface RequestContext {
    tabId: number,
    frameId: number,
    timestamp: number // in ms

    requestUrl?: string
    referrerUrl?: string
    requestType?: RequestType
    contentType?: ContentType
    requestFrameId?: number
    thirdParty?: boolean
    matchingResult?: MatchingResult | null
}

export interface RequestContextStorageInterface {
    get: (requestId: string) => RequestContext | undefined;
    record: (requestId: string, data: RequestContext) => RequestContext;
    update: (requestId: string, data: Partial<RequestContext>) => void;
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