import { type WebRequest } from 'webextension-polyfill';
import { type CosmeticResult, type MatchingResult, type HTTPMethod } from '@adguard/tsurlfilter';

import { type ParsedCookie } from '../../../common/cookie-filtering/parsed-cookie';
import { type ContentType } from '../../../common/request-type';
import { logger } from '../../../common/utils/logger';
import { nanoid } from '../../../common/utils/nanoid';
import { type TabFrameRequestContextMV2 } from '../tabs/tabs-api';

/**
 * Request context state. It represents the current state of the request processing.
 */
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
export type RequestContext = TabFrameRequestContextMV2 & {
    /**
     * During redirect processing, multiple events are processed in the same request lifecycle.
     * We need a unique identifier to separate these requests in the filtering log.
     *
     * @see https://developer.chrome.com/docs/extensions/reference/webRequest/#life-cycle-of-requests
     */
    eventId: string;

    state: RequestContextState;

    /**
     * WebRequest event timestamp, in milliseconds since the epoch.
     */
    timestamp: number;
    referrerUrl: string;
    contentType: ContentType;
    requestFrameId: number;
    thirdParty: boolean;
    method: HTTPMethod;

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
    cosmeticResult?: CosmeticResult;
};

/**
 * Create request context DTO.
 */
type CreateRequestContext = Omit<RequestContext, 'eventId'>;

/**
 * Implementation of the request context storage.
 */
export class RequestContextStorage extends Map<string, RequestContext> {
    /**
     * The request storage cleanup timeout.
     */
    private static CLEANUP_TIMEOUT_MS = 60_000; // 1 min

    /**
     * The request context data lifetime.
     * It is based on the default browser 5 minutes request idle timeout + 1 second.
     *
     * @see https://source.chromium.org/chromium/chromium/src/+/main:net/socket/client_socket_pool.cc;l=41
     */
    private static REQUEST_CONTEXT_LIFETIME_MS = 301_000;

    private cleanupTimerId?: number;

    /** @inheritdoc */
    constructor() {
        super();
        this.scheduleCleanup = this.scheduleCleanup.bind(this);
    }

    /**
     * Create new request context.
     *
     * @param requestId Request id.
     * @param data Request context with a omitted eventId field. It is automatically generated.
     *
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
     *
     * @returns Updated request context.
     */
    public update(requestId: string, data: Partial<RequestContext>): RequestContext | undefined {
        const requestContext = super.get(requestId);

        if (requestContext) {
            Object.assign(requestContext, data);
            return requestContext;
        }

        if (!data.timestamp) {
            // Incomplete event. Adding timestamp so that the clean up logic could work for it.
            data.timestamp = Date.now();
        }

        // TODO: Throws error if request context not found after RequestEvents refactoring.
        logger.error('[tsweb.RequestContextStorage.update]: request context not found for requestId: ', requestId);
        super.set(requestId, data as RequestContext);
        return undefined;
    }

    /**
     * Some requests may not trigger the onCompleted event and therefore will not be removed from the store.
     * This can occur, for example, with program redirects in the {@link ResourcesService}.
     * To solve this issue, we clean up the store by checking the records timestamps every
     * {@link CLEANUP_TIMEOUT_MS} milliseconds and deleting the expired records.
     */
    public scheduleCleanup(): void {
        // If cleanup has already scheduled, clear previous timer.
        this.clearCleanupTimer();

        this.cleanupTimerId = window.setTimeout(() => {
            const now = Date.now();
            super.forEach(({ timestamp }, key) => {
                if (now > timestamp + RequestContextStorage.REQUEST_CONTEXT_LIFETIME_MS) {
                    super.delete(key);
                }
            });

            this.scheduleCleanup();
        }, RequestContextStorage.CLEANUP_TIMEOUT_MS);
    }

    /**
     * Clears cleanup timer, if it exists.
     */
    public clearCleanupTimer(): void {
        if (this.cleanupTimerId) {
            window.clearTimeout(this.cleanupTimerId);
            this.cleanupTimerId = undefined;
        }
    }
}

// TODO: do not create global instance of storage.
export const requestContextStorage = new RequestContextStorage();
requestContextStorage.scheduleCleanup();
