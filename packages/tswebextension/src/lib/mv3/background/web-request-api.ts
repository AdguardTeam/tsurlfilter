/**
 * @file
 * API for applying rules from background service
 * by handling web Request API and web navigation events.
 *
 * This scheme describes flow for MV3.
 *
 * Event data is aggregated into two contexts: {@link RequestContext},
 * which contains data about the specified request
 * and {@link TabContext} which contains data about the specified tab.
 *
 *
 * Applying {@link NetworkRule} from the background page:
 *
 * The {@link MatchingResult} of specified request is calculated and stored in context storages,
 * at the time {@link RequestEvents.onBeforeRequest} is processed.
 *
 * At {@link RequestEvents.onBeforeSendHeaders}, the request headers will be parsed to apply $cookie rules
 * based on the {@link MatchingResult} stored in {@link requestContextStorage}.
 * At {@link RequestEvents.onHeadersReceived}, the response headers are handled in the same way.
 *
 * The specified {@link RequestContext} will be removed from {@link requestContextStorage}
 * on {@link RequestEvents.onCompleted} or {@link RequestEvents.onErrorOccurred} events.
 *
 *
 * Web Request API Event Handling:
 *
 *                                       ┌─────────────────────────────┐
 * Matches {@link MatchingResult}        │                             │
 * for the request.                      │       onBeforeRequest       ◄─┐
 *                                       │                             │ │
 *                                       └──────────────┬──────────────┘ │
 *                                                      │                │
 *                                                      │                │
 *                                                      │                │
 *                                       ┌──────────────▼──────────────┐ │
 * Parses request headers and applies    │                             │ │
 * $cookie rules based on                │      onBeforeSendHeaders    ◄─┼┐
 * {@link MatchingResult}.               │                             │ ││
 *                                       └──────────────┬──────────────┘ ││
 *                                                      │                ││
 *                                       ┌──────────────▼──────────────┐ ││
 *                                       │                             │ ││
 *                                       │        onSendHeaders        │ ││
 *                                       │                             │ ││
 *                                       └──────────────┬──────────────┘ ││
 *                                                      │                ││
 *                                       ┌──────────────▼──────────────┐ ││
 * Parses response headers and applies   │                             │ ││
 * $cookie rules based on              ┌─┤      onHeadersReceived      │ ││
 * {@link MatchingResult}.             │ │                             │ ││
 *                                     │ └─────────────────────────────┘ ││
 *                                     │                                 ││
 *                                     │ ┌─────────────────────────────┐ ││
 *                                     │ │                             │ ││
 *                                     ├─►       onBeforeRedirect      ├─┴┤
 *                                     │ │                             │  │
 *                                     │ └─────────────────────────────┘  │
 *                                     │                                  │
 *                                     │ ┌─────────────────────────────┐  │
 *                                     │ │                             │  │
 *                                     ├─►        onAuthRequired       ├──┘
 *                                     │ │                             │
 *                                     │ └─────────────────────────────┘
 *                                     │
 *                                     │ ┌─────────────────────────────┐
 *                                     │ │                             │
 *                                     └─►      onResponseStarted      │
 *                                       │                             │
 *                                       └──────────────┬──────────────┘
 *                                                      │
 *                                       ┌──────────────▼──────────────┐
 * Remove the request information        │                             │
 * from {@link requestContextStorage}.   │         onCompleted         │
 *                                       │                             │
 *                                       └─────────────────────────────┘.
 *
 *                                       ┌─────────────────────────────┐
 * Remove the request information        │                             │
 * from {@link requestContextStorage}.   │       onErrorOccurred       │
 *                                       │                             │
 *                                       └─────────────────────────────┘.
 */
import browser, { WebRequest } from 'webextension-polyfill';

import { isExtensionUrl, isHttpOrWsRequest } from '../../common/utils/url';
import {
    BACKGROUND_TAB_ID,
    FilteringEventType,
    defaultFilteringLog,
    getErrorMessage,
} from '../../common';
import { RequestEvents } from './request/events/request-events';
import { type RequestData } from './request/events/request-event';
import { cookieFiltering } from './services/cookie-filtering/cookie-filtering';
import { engineApi } from './engine-api';
import { requestContextStorage } from './request/request-context-storage';

/**
 * API for applying rules from background service by handling
 * Web Request API and web navigation events.
 *
 * TODO: Calculate  matchingResult and cosmeticResult save them to the cache
 * related to pair tabId+documentId to save execution time of future requests
 * cosmetic rules from content-script.
 */
export class WebRequestApi {
    /**
     * Adds listeners to web request events.
     */
    public static start(): void {
        RequestEvents.onBeforeRequest.addListener(WebRequestApi.onBeforeRequest);
        RequestEvents.onBeforeSendHeaders.addListener(WebRequestApi.onBeforeSendHeaders);
        RequestEvents.onHeadersReceived.addListener(WebRequestApi.onHeadersReceived);
    }

    /**
     * Removes web request event handlers.
     */
    public static stop(): void {
        RequestEvents.onBeforeRequest.removeListener(WebRequestApi.onBeforeRequest);
        RequestEvents.onBeforeSendHeaders.removeListener(WebRequestApi.onBeforeSendHeaders);
        RequestEvents.onHeadersReceived.removeListener(WebRequestApi.onHeadersReceived);
    }

    /**
     * Flush browser in-memory cache.
     *
     * This function is called after an engine update or filtering switch to ensure
     * that new rules are applied to requests that may have been cached by the browser.
     */
    public static async flushMemoryCache(): Promise<void> {
        try {
            await browser.webRequest.handlerBehaviorChanged();
        } catch (e) {
            const errorMessage = getErrorMessage(e);
            throw new Error(`Cannot flush memory cache and call browser.handlerBehaviorChanged: ${errorMessage}`);
        }
    }

    /**
     * On before request event handler. This is the earliest event in the chain of the web request events.
     *
     * @param details Request details.
     * @param details.context Request context.
     */
    private static onBeforeRequest(
        { context }: RequestData<WebRequest.OnBeforeRequestDetailsType>,
    ): void {
        if (!context) {
            return;
        }
        const {
            requestType,
            requestUrl,
            referrerUrl,
            requestId,
            method,
        } = context;

        if (!isHttpOrWsRequest(requestUrl)) {
            return;
        }

        const frameRule = engineApi.matchFrame(requestUrl);

        const result = engineApi.matchRequest({
            requestUrl,
            frameUrl: referrerUrl,
            requestType,
            frameRule,
            method,
        });

        if (!result) {
            return;
        }

        // Save matching result to the request context
        requestContextStorage.update(requestId, {
            matchingResult: result,
        });
    }

    /**
     * On before send headers event handler.
     *
     * @param details On before send headers details.
     * @param details.context Details context.
     */
    private static onBeforeSendHeaders(
        { context }: RequestData<WebRequest.OnBeforeSendHeadersDetailsType>,
    ): void {
        if (!context) {
            return;
        }

        const {
            referrerUrl,
            tabId,
        } = context;

        /**
         * TODO: Remove Cookie header from requests initiated by the background
         * extension via Declarative Net Request to implement SanitizeApi
         * functionality from MV2.
         */
        if (tabId === BACKGROUND_TAB_ID && isExtensionUrl(referrerUrl)) {
            return;
        }

        // If the current request does not comply with any rules - we do not
        // need to call any other processing services (e.g. cookie, header)
        if (context?.matchingResult) {
            cookieFiltering.onBeforeSendHeaders(context);
        }
    }

    /**
     * On headers received event handler.
     *
     * @param event On headers received event.
     * @param event.context Event context.
     * @param event.details On headers received details.
     */
    private static onHeadersReceived({
        context,
        details,
    }: RequestData<WebRequest.OnHeadersReceivedDetailsType>): void {
        defaultFilteringLog.publishEvent({
            type: FilteringEventType.ReceiveResponse,
            data: {
                tabId: details.tabId,
                eventId: details.requestId,
                statusCode: details.statusCode,
            },
        });

        if (!context?.matchingResult) {
            return;
        }

        cookieFiltering.onHeadersReceived(context);
    }
}
