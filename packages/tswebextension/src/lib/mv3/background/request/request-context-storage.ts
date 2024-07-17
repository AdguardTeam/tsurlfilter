import type { WebRequest } from 'webextension-polyfill';
import type { MatchingResult, HTTPMethod, CosmeticResult } from '@adguard/tsurlfilter';

// Non-secure to not use Buffer in service worker.
import { nanoid } from 'nanoid/non-secure';
import type { ContentType } from '../../../common';
import type { ParsedCookie } from '../../../common/cookie-filtering/parsed-cookie';
import type { TabFrameRequestContext } from '../../tabs/tabs-api';

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
};

/**
 * Create request context DTO.
 */
type CreateRequestContext = Omit<RequestContext, 'eventId'>;

/**
 * Implementation of the request context storage.
 *
 * TODO: Add persistent storage for cases of deaths service worker.
 */
export class RequestContextStorage extends Map<string, RequestContext> {
    /**
     * Create new request context.
     *
     * @param requestId Request id.
     * @param data Request context with a omitted eventId field. It is automatically generated.
     * @returns Request context storage instance.
     */
    public create(requestId: string, data: CreateRequestContext): RequestContext {
        const requestContext: RequestContext = {
            eventId: nanoid(),
            ...data,
        };

        super.set(requestId, requestContext);

        return requestContext;
    }

    /**
     * Update request context fields. Can be done partially.
     *
     * @param requestId Request id.
     * @param data Partial request context.
     * @returns Updated request context.
     */
    public update(requestId: string, data: Partial<RequestContext>): RequestContext | undefined {
        const requestContext = super.get(requestId);

        if (requestContext) {
            Object.assign(requestContext, data);
            return requestContext;
        }

        // TODO: Throws error if request context not found after RequestEvents refactoring.
        super.set(requestId, data as RequestContext);
        return undefined;
    }
}

export const requestContextStorage = new RequestContextStorage();
