import { MatchingResult, RequestType } from '@adguard/tsurlfilter';

export interface RequestContext {
    requestUrl: string
    referrerUrl: string
    requestType: RequestType
    tabId: number
    frameId: number
    timestamp: number // in ms
    matchingResult: MatchingResult | null
}

export interface RequestContextStorageInterface {
    get: (requestId: string) => RequestContext | undefined;
    record: (requestId: string, data: RequestContext) => void;
    update: (requestId: string, data: Partial<RequestContext>) => void;
    delete: (requestId: string) => void;

}

export class RequestContextStorage implements RequestContextStorageInterface {
    private contextStorage = new Map<string, RequestContext>();

    public get(requestId: string): RequestContext | undefined {
        return this.contextStorage.get(requestId);
    }

    public record(requestId: string, data: RequestContext): void {
        this.contextStorage.set(requestId, data);
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