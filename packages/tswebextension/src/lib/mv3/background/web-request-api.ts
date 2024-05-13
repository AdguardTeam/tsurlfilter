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
 * If this is a frame request,           │                             │ │
 * also matches the                      └──────────────┬──────────────┘ │
 * {@link CosmeticResult}                               │                │
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
 *
 *  Web Navigation API Event Handling:
 *
 *                                       ┌─────────────────────────────┐
 *                                       │                             │
 *                                       │  onCreatedNavigationTarget  │
 *                                       │                             │
 *                                       └──────────────┬──────────────┘
 *                                                      │
 *                                       ┌──────────────▼──────────────┐
 * Update main frame data with           │                             │
 * {@link updateMainFrameData}           │       onBeforeNavigate      │
 *                                       │                             │
 *                                       └──────────────┬──────────────┘
 *                                                      │
 *                                       ┌──────────────▼──────────────┐
 *                                       │                             │
 *                                       │         onCommitted         │
 *                                       │                             │
 *                                       └──────────────┬──────────────┘
 *                                                      │
 *                                       ┌──────────────▼──────────────┐
 *                                       │                             │
 *                                       │      onDOMContentLoaded     ├─┐
 *                                       │                             │ │
 *                                       └──────────────┬──────────────┘ │
 *                                                      │                │
 *                                       ┌──────────────▼──────────────┐ │
 * Remove the frame data                 │                             │ │
 * from {@link TabContext}.            ┌─┤         onCompleted         │ │
 *                                     │ │                             │ │
 *                                     │ └─────────────────────────────┘ │
 *                                     │                                 │
 *                                     │ ┌─────────────────────────────┐ │
 *                                     │ │                             │ │
 *                                     ├─►    onHistoryStateUpdated    ◄─┤
 *                                     │ │                             │ │
 *                                     │ └─────────────────────────────┘ │
 *                                     │                                 │
 *                                     │ ┌─────────────────────────────┐ │
 *                                     │ │                             │ │
 *                                     └─►  onReferenceFragmentUpdated ◄─┘
 *                                       │                             │
 *                                       └─────────────────────────────┘.
 *
 *                                       ┌─────────────────────────────┐
 * Remove the frame data                 │                             │
 * from {@link TabContext}.              │       onErrorOccurred       │
 *                                       │                             │
 *                                       └─────────────────────────────┘.
 */
import browser, { type WebRequest, type WebNavigation } from 'webextension-polyfill';

import { RequestType } from '@adguard/tsurlfilter/es/request-type';

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
import { tabsApi } from '../tabs/tabs-api';
import { MAIN_FRAME_ID } from '../tabs/frame';
import { requestContextStorage } from './request/request-context-storage';
import { RequestBlockingApi } from './request/request-blocking-api';

const FRAME_DELETION_TIMEOUT = 3000;

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
        RequestEvents.onCompleted.addListener(WebRequestApi.onCompleted);
        RequestEvents.onErrorOccurred.addListener(WebRequestApi.onErrorOccurred);

        // browser.webNavigation Events
        browser.webNavigation.onBeforeNavigate.addListener(WebRequestApi.onBeforeNavigate);
        browser.webNavigation.onErrorOccurred.addListener(WebRequestApi.deleteFrameContext);
        browser.webNavigation.onCompleted.addListener(WebRequestApi.deleteFrameContext);
    }

    /**
     * Removes web request event handlers.
     */
    public static stop(): void {
        RequestEvents.onBeforeRequest.removeListener(WebRequestApi.onBeforeRequest);
        RequestEvents.onBeforeSendHeaders.removeListener(WebRequestApi.onBeforeSendHeaders);
        RequestEvents.onHeadersReceived.removeListener(WebRequestApi.onHeadersReceived);
        RequestEvents.onErrorOccurred.removeListener(WebRequestApi.onErrorOccurred);
        RequestEvents.onCompleted.removeListener(WebRequestApi.onCompleted);

        // browser.webNavigation Events
        browser.webNavigation.onBeforeNavigate.removeListener(WebRequestApi.onBeforeNavigate);
        browser.webNavigation.onErrorOccurred.removeListener(WebRequestApi.deleteFrameContext);
        browser.webNavigation.onCompleted.removeListener(WebRequestApi.deleteFrameContext);
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
            tabId,
            frameId,
        } = context;

        if (!isHttpOrWsRequest(requestUrl)) {
            return;
        }

        let frameRule = null;
        if (requestType === RequestType.SubDocument) {
            frameRule = engineApi.matchFrame(referrerUrl);
        } else {
            frameRule = tabsApi.getTabFrameRule(tabId);
        }

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

        if (requestType === RequestType.Document || requestType === RequestType.SubDocument) {
            tabsApi.handleFrameMatchingResult(tabId, frameId, result);

            const cosmeticOption = result.getCosmeticOption();

            const cosmeticResult = engineApi.getCosmeticResult(requestUrl, cosmeticOption);

            // Save cosmeticResult for future return it from cache without recalculating.
            tabsApi.handleFrameCosmeticResult(tabId, frameId, cosmeticResult);
            requestContextStorage.update(requestId, { cosmeticResult });
        }

        const basicResult = result.getBasicResult();

        // For a $replace rule, response will be undefined since we need to get
        // the response in order to actually apply $replace rules to it.
        const response = RequestBlockingApi.getBlockingResponse({
            rule: basicResult,
            popupRule: result.getPopupRule(),
            requestType,
            tabId,
            referrerUrl,
        });

        // redirects should be considered as blocked for the tab blocked request count
        // which is displayed on the extension badge
        // https://github.com/AdguardTeam/AdguardBrowserExtension/issues/2443
        if (response?.cancel || response?.redirectUrl !== undefined) {
            tabsApi.incrementTabBlockedRequestCount(tabId, referrerUrl);

            // TODO: Check, if we need collapse elements, we should uncomment this code.
            // const mainFrameUrl = tabsApi.getTabMainFrame(tabId)?.url;
            // hideRequestInitiatorElement(
            //     tabId,
            //     requestFrameId,
            //     requestUrl,
            //     mainFrameUrl || referrerUrl,
            //     requestType,
            //     thirdParty,
            // );
        }
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

    /**
     * On before navigate web navigation event handler.
     *
     * @param details Event details.
     */
    private static onBeforeNavigate(details: WebNavigation.OnBeforeNavigateDetailsType): void {
        const { frameId, tabId, url } = details;

        if (frameId === MAIN_FRAME_ID) {
            tabsApi.handleTabNavigation(tabId, url);
        }
    }

    /**
     * Event handler for onErrorOccurred event. It fires when an error occurs.
     *
     * @param event On error occurred event.
     * @param event.details On error occurred event details.
     */
    private static onErrorOccurred({
        details,
    }: RequestData<WebRequest.OnErrorOccurredDetailsType>): void {
        requestContextStorage.delete(details.requestId);
    }

    /**
     * This is handler for the last event from the request lifecycle.
     *
     * @param event On completed event.
     * @param event.context Request context.
     * @private
     */
    private static onCompleted({
        context,
    }: RequestData<WebRequest.OnCompletedDetailsType>): void {
        if (!context) {
            return;
        }

        const { requestId } = context;

        requestContextStorage.delete(requestId);
    }

    /**
     * Delete frame data from tab context when navigation is finished.
     * @param details Navigation event details.
     */
    private static deleteFrameContext(
        details: WebNavigation.OnCompletedDetailsType | WebNavigation.OnErrorOccurredDetailsType,
    ): void {
        const { tabId, frameId } = details;
        const tabContext = tabsApi.getTabContext(tabId);

        if (!tabContext) {
            return;
        }

        /**
         * On creation of an empty iframe with subsequent url assignment,
         * WebNavigation.onCompleted of the frame could fire before WebRequest.onCommitted,
         * removing the frame context with it's matching and cosmetic results before it could be applied.
         *
         * TODO: add the ability to prolong request and tab/frame contexts lives if it was not yet consumed
         * at webRequest or webNavigation events, i.e
         *   - keep requestContext, if webRequest.onCommitted has not been fired,
         *   - keep tab context if webNavigation.omCompleted has not been fired,
         * etc.
         */
        setTimeout(() => tabContext.frames.delete(frameId), FRAME_DELETION_TIMEOUT);
    }
}
