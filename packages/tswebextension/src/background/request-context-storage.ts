import { RequestType } from '@adguard/tsurlfilter';

export interface RequestContext {
    requestId: string;
    requestUrl: string
    referrerUrl: string
    originUrl: string
    requestType: RequestType
    tabId: number
    method: string
    timestamp: number // in ms
}

export interface CreateRequestContext {
    requestId: string
    requestUrl: string
    referrerUrl: string
    originUrl: string
    requestType: RequestType
    tabId: number
    method: string
}

export interface UpdateRequestContext {
    timestamp: number // in ms;
}

export interface RequestContextStorageInterface {
    record: (data: CreateRequestContext) => void;
    get: (requestId: string) => RequestContext | undefined;
    update: (requestId: string, data: Partial<UpdateRequestContext>) => void;
    delete: (requestId: string) => void;

}

export class RequestContextStorage implements RequestContextStorageInterface {
    private contextStorage = new Map<string, RequestContext>();

    public record(data: CreateRequestContext): void {
        this.contextStorage.set(data.requestId, { ...data, timestamp: Date.now() });
    }

    public get(requestId: string): RequestContext | undefined {
        return this.contextStorage.get(requestId);
    }

    public update(requestId: string, data: Partial<UpdateRequestContext>): void {
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