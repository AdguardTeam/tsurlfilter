/**
 * @file
 * API for applying rules from background service
 * by handling web Request API and web navigation events.
 *
 * This scheme describes flow for MV2.
 *
 * Event data is aggregated into two contexts: {@link RequestContext},
 * which contains data about the specified request
 * and {@link TabContext} which contains data about the specified tab and frames inside it.
 *
 * Applying {@link NetworkRule} from the background page:
 *
 * In case if {@link browser.tabs.onCreated} event is not fired before —
 * we create a {@link TabContext} manually for document requests,
 * and the {@link MatchingResult} of specified request is calculated and stored in tab context storage,
 * at the time {@link RequestEvents.onBeforeRequest} or {@link WebNavigation.onBeforeNavigate} is processed.
 * In the most cases the onBeforeNavigate event is processed before onBeforeRequest.
 *
 * The handler for this event also computes the response based on {@link MatchingResult}
 * via {@link RequestBlockingApi.getBlockingResponse}.
 * If the rule is blocking rule, the request will be cancelled, otherwise it will be handled by the next handlers.
 * If content filtering is supported, it will be initialized for non-blocking requests.
 *
 * At {@link RequestEvents.onBeforeSendHeaders}, the request headers are modified or deleted
 * based on the {@link MatchingResult} stored in {@link requestContextStorage}.
 * At {@link RequestEvents.onHeadersReceived}, the response headers are handled in the same way,
 * and also the 'trusted-types' directive is modified for CSP headers, @see {@link TrustedTypesService}.
 *
 * At {@link RequestEvents.onCompleted}, cosmetics are injected for subdocuments in Firefox.
 *
 * The specified {@link RequestContext} will be removed from {@link requestContextStorage}
 * on {@link RequestEvents.onCompleted} or {@link RequestEvents.onErrorOccurred} events.
 *
 *
 *  Applying {@link CosmeticRule} from the background page.
 *
 * We pre-calculate cosmetics for the request as soon as possible —
 * on {@link browser.webNavigation.onBeforeNavigate} or {@link RequestEvents.onBeforeRequest} events,
 * depending on which event is processed first, (there is a guard clause for this).
 * Pre-calculated cosmetics are stored in the context of frames.
 *
 * To get the scripts up and running as quickly as possible
 * we try to inject them the first time during the {@link RequestEvents.onResponseStarted}.
 *
 * All cosmetic rules are then injected on the {@link browser.webNavigation.onCommitted}
 * or {@link browser.webNavigation.onDOMContentLoaded} events.
 *
 * The frame data will be removed from the specified {@link TabContext} on {@link browser.webNavigation.onCompleted} or
 * {@link browser.webNavigation.onErrorOccurred } events.
 *
 *  Web Request API Event Handling:
 *
 *                                       ┌─────────────────────────────┐
 * Create {@link TabContext}             │                             │
 * if it's not created before,           │       onBeforeRequest       ◄─┐
 * and matches {@link MatchingResult}    │                             │ │
 * for the request.                      └──────────────┬──────────────┘ │
 * If this is a frame request, also                     │                │
 * pre-calculates {@link CosmeticResult}                │                │
 * for the specified frame,                             │                │
 * and stores it in the frame context.                  │                │
 *                                                      │                │
 * If the request is neither blocked                    │                │
 * nor redirected, apply the                            │                │
 * $removeparam rules.                                  │                │
 * In Firefox, if the request                           │                │
 * is not blocked,                                      │                │
 * initialize content filtering.                        │                │
 * After that, check if a request is                    │                │
 * third-party and has type CSP_REPORT                  │                │
 * - then block it.                                     │                │
 *                                                      │                │
 *                                                      │                │
 *                                       ┌──────────────▼──────────────┐ │
 * Removes or modifies request           │                             │ │
 * headers based on                      │      onBeforeSendHeaders    ◄─┼─┐
 * {@link MatchingResult}.               │                             │ │ │
 *                                       └──────────────┬──────────────┘ │ │
 *                                                      │                │ │
 *                                       ┌──────────────▼──────────────┐ │ │
 *                                       │                             │ │ │
 *                                       │        onSendHeaders        │ │ │
 *                                       │                             │ │ │
 *                                       └──────────────┬──────────────┘ │ │
 *                                                      │                │ │
 *                                       ┌──────────────▼──────────────┐ │ │
 * Removes or modifies response          │                             │ │ │
 * headers based on                    ┌─┤      onHeadersReceived      │ │ │
 * {@link MatchingResult}.             │ │                             │ │ │
 * Modifies 'trusted-types' directive  │ └─────────────────────────────┘ │ │
 * for CSP headers                     │                                 │ │
 * via {@link TrustedTypesService}.    │                                 │ │
 *                                     │                                 │ │
 *                                     │                                 │ │
 *                                     │ ┌─────────────────────────────┐ │ │
 *                                     │ │                             │ │ │
 *                                     ├─►       onBeforeRedirect      ├─┘ │
 *                                     │ │                             │   │
 *                                     │ └─────────────────────────────┘   │
 *                                     │                                   │
 *                                     │ ┌─────────────────────────────┐   │
 *                                     │ │                             │   │
 *                                     ├─►        onAuthRequired       ├───┘
 *                                     │ │                             │
 *                                     │ └─────────────────────────────┘
 *                                     │
 *                                     │ ┌─────────────────────────────┐
 * Tries injecting JS rules into the   │ │                             │
 * frame based on pre-calculate        └─►      onResponseStarted      │
 * cosmetic result.                      │                             │
 *                                       └──────────────┬──────────────┘
 *                                                      │
 *                                       ┌──────────────▼──────────────┐
 * Injects cosmetics for subdocuments    │                             │
 * in Firefox (AG-40169). Logs script    │         onCompleted         │
 * rules for main and sub frames.        │                             │
 * Removes the request information       └─────────────────────────────┘
 * from {@link requestContextStorage}.
 *
 *                                       ┌─────────────────────────────┐
 * Remove the request information        │                             │
 * from {@link requestContextStorage}.   │       onErrorOccurred       │
 *                                       │                             │
 *                                       └─────────────────────────────┘.
 *
 *
 * Web Navigation API Event Handling:
 *
 *                                       ┌─────────────────────────────┐
 *                                       │                             │
 *                                       │  onCreatedNavigationTarget  │
 *                                       │                             │
 *                                       └──────────────┬──────────────┘
 *                                                      │
 *                                       ┌──────────────▼──────────────┐
 * Create {@link TabContext}             │                             │
 * if it's not created before,           │       onBeforeNavigate      │
 * and update main frame data with       │                             │
 * {@link updateMainFrameData}           └──────────────┬──────────────┘
 * and pre-calculate cosmetics                          │
 * so it can be applied later.                          │
 *                                                      │
 *                                                      │
 *                                       ┌──────────────▼──────────────┐
 * Try injecting CSS and JS rules        │                             │
 * into the frame with source based on   │         onCommitted         │
 * pre-calculated cosmetic result.       │                             │
 *                                       └──────────────┬──────────────┘
 *                                                      │
 *                                       ┌──────────────▼──────────────┐
 * Try injecting CSS and JS rules        │                             │
 * into the subdocument frame without    │      onDOMContentLoaded     ├─┐
 * source based on pre-calculated        │                             │ │
 * cosmetic result.                      └──────────────┬──────────────┘ │
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

import { type DocumentLifecycle } from '../../common/interfaces';
import { CommonAssistant, type CommonAssistantDetails } from '../../common/assistant';
import { FRAME_DELETION_TIMEOUT_MS, MAIN_FRAME_ID } from '../../common/constants';
import { defaultFilteringLog, FilteringEventType } from '../../common/filtering-log';
import { findHeaderByName } from '../../common/utils/headers';
import { logger } from '../../common/utils/logger';
import { isHttpOrWsRequest, getDomain } from '../../common/utils/url';

import {
    cosmeticFrameProcessor,
    documentApi,
    engineApi,
    tabsApi,
} from './api';
import { CosmeticApi } from './cosmetic-api';
import { ContentFiltering } from './services/content-filtering/content-filtering';
import { cookieFiltering } from './services/cookie-filtering/cookie-filtering';
import { cspService } from './services/csp-service';
import { paramsService } from './services/params-service';
import { permissionsPolicyService } from './services/permissions-policy-service';
import { TrustedTypesService } from './services/trusted-types-service';
import { removeHeadersService } from './services/remove-headers-service';
import {
    hideRequestInitiatorElement,
    RequestEvents,
    type RequestData,
    requestContextStorage,
    RequestBlockingApi,
} from './request';
import { SanitizeApi } from './sanitize-api';
import { stealthApi } from './stealth-api';
import { TabsApi } from './tabs';
import { type OnBeforeRequestDetailsType } from './request/events/request-events';
import { FrameMV2 } from './tabs/frame';
import { browserDetectorMV2 } from './utils/browser-detector';

export type WebRequestEventResponse = WebRequest.BlockingResponseOrPromise | void;

export type InjectCosmeticParams = {
    frameId: number;
    tabId: number;
    timestamp: number;
    url: string;
};

type OnBeforeNavigateDetailsType = WebNavigation.OnBeforeNavigateDetailsType & {
    /**
     * The UUID of the document making the request.
     * TODO: Use this field instead of generating it in the code.
     */
    documentId?: string;
    /**
     * The document lifecycle of the frame.
     *
     * Available from Chrome 106+.
     *
     * @see https://developer.chrome.com/docs/extensions/reference/api/extensionTypes#type-DocumentLifecycle
     */
    documentLifecycle?: DocumentLifecycle;
};

/**
 * API for applying rules from background service by handling
 * Web Request API and web navigation events.
 */
export class WebRequestApi {
    /**
     * Adds listeners to web request events.
     */
    public static start(): void {
        // browser.webRequest Events
        RequestEvents.onBeforeRequest.addListener(WebRequestApi.onBeforeRequest);
        // Note: onBeforeCspReport should be registered after onBeforeRequest
        // because it depends on the MatchingResult calculation for the request
        // that is performed in onBeforeRequest, and in WebRequestApi all
        // request handlers will be called in the order of registration.
        RequestEvents.onBeforeRequest.addListener(WebRequestApi.onBeforeCspReport);
        RequestEvents.onBeforeSendHeaders.addListener(WebRequestApi.onBeforeSendHeaders);
        RequestEvents.onHeadersReceived.addListener(WebRequestApi.onHeadersReceived);
        RequestEvents.onResponseStarted.addListener(WebRequestApi.onResponseStarted);
        RequestEvents.onErrorOccurred.addListener(WebRequestApi.onErrorOccurred);
        RequestEvents.onCompleted.addListener(WebRequestApi.onCompleted);

        // browser.webNavigation Events
        // Note: We need to force set matching result in Opera before run `WebRequestApi.onCommitted`
        // TODO: remove this when Opera bug is fixed.
        browser.webNavigation.onCommitted.addListener(WebRequestApi.onCommittedOperaHook);
        browser.webNavigation.onCommitted.addListener(WebRequestApi.onCommitted);
        browser.webNavigation.onBeforeNavigate.addListener(WebRequestApi.onBeforeNavigate);
        browser.webNavigation.onDOMContentLoaded.addListener(WebRequestApi.onDomContentLoaded);
        browser.webNavigation.onCompleted.addListener(WebRequestApi.deleteFrameContext);
        browser.webNavigation.onErrorOccurred.addListener(WebRequestApi.deleteFrameContext);
    }

    /**
     * Removes web request event handlers.
     */
    public static stop(): void {
        RequestEvents.onBeforeRequest.removeListener(WebRequestApi.onBeforeRequest);
        RequestEvents.onBeforeRequest.removeListener(WebRequestApi.onBeforeCspReport);
        RequestEvents.onBeforeSendHeaders.removeListener(WebRequestApi.onBeforeSendHeaders);
        RequestEvents.onHeadersReceived.removeListener(WebRequestApi.onHeadersReceived);
        RequestEvents.onResponseStarted.removeListener(WebRequestApi.onResponseStarted);
        RequestEvents.onErrorOccurred.removeListener(WebRequestApi.onErrorOccurred);
        RequestEvents.onCompleted.removeListener(WebRequestApi.onCompleted);

        browser.webNavigation.onCommitted.removeListener(WebRequestApi.onCommitted);
        browser.webNavigation.onCommitted.removeListener(WebRequestApi.onCommittedOperaHook);
        browser.webNavigation.onBeforeNavigate.removeListener(WebRequestApi.onBeforeNavigate);
        browser.webNavigation.onDOMContentLoaded.removeListener(WebRequestApi.onDomContentLoaded);
        browser.webNavigation.onCompleted.removeListener(WebRequestApi.deleteFrameContext);
        browser.webNavigation.onErrorOccurred.removeListener(WebRequestApi.deleteFrameContext);
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
            logger.error('[tsweb.WebRequestApi.flushMemoryCache]: Cannot flush memory cache and call browser.handlerBehaviorChanged: ', e);
        }
    }

    /**
     * On before request event handler. This is the earliest event in the chain of the web request events.
     *
     * @param data Request data.
     * @param data.context Request context.
     * @param data.details Event details.
     *
     * @returns Web request response or void if there is nothing to do.
     */
    private static onBeforeRequest(
        { context, details }: RequestData<OnBeforeRequestDetailsType>,
    ): WebRequestEventResponse {
        if (!context) {
            return undefined;
        }

        const {
            requestType,
            tabId,
            frameId,
            requestUrl,
            referrerUrl,
            eventId,
            requestId,
            contentType,
            timestamp,
            thirdParty,
            method,
            requestFrameId,
        } = context;

        const { parentFrameId } = details;

        const isDocumentRequest = requestType === RequestType.Document;

        /**
         * In some cases `onBeforeRequest` might happen before Tabs API `onCreated`
         * event is fired or even not fired at all
         * (e.g. {@link https://github.com/microsoft/MicrosoftEdge-Extensions/issues/296 | Edge Split Screen Issue}),
         * in this cases we need to create tab context manually. This is needed
         * to ensure that we have tab context to be able to inject cosmetics and scripts.
         *
         * We create tab context only for document requests,
         * because other types of requests can't have tab context.
         */
        if (isDocumentRequest) {
            tabsApi.createTabContextIfNotExists(tabId, requestUrl);
        }

        const isDocumentOrSubDocumentRequest = isDocumentRequest || requestType === RequestType.SubDocument;

        let skipPrecalculation = true;
        if (isDocumentOrSubDocumentRequest) {
            skipPrecalculation = cosmeticFrameProcessor.shouldSkipRecalculation(
                tabId,
                frameId,
                requestUrl,
                timestamp,
            );

            if (!skipPrecalculation) {
                /**
                 * Set in the beginning to let other events know that cosmetic result
                 * will be calculated in this event to avoid double calculation.
                 */
                tabsApi.setFrameContext(tabId, frameId, new FrameMV2({
                    tabId,
                    frameId,
                    parentFrameId,
                    url: requestUrl,
                    timeStamp: timestamp,
                    documentId: details.documentId,
                    parentDocumentId: details.parentDocumentId,
                }));
            }
        }

        if (!isHttpOrWsRequest(requestUrl)) {
            return undefined;
        }

        /**
         * We use here referrerUrl as frameUrl for all type of requests, because
         * we have pre-process for this in {@link RequestEvents.handleOnBeforeRequest},
         * where we can set `referrerUrl` to `requestUrl` for prerender requests.
         */
        const frameUrl = referrerUrl;

        defaultFilteringLog.publishEvent({
            type: FilteringEventType.SendRequest,
            data: {
                tabId,
                eventId,
                requestUrl,
                requestDomain: getDomain(requestUrl),
                frameUrl,
                frameDomain: getDomain(frameUrl),
                requestType: contentType,
                timestamp,
                requestThirdParty: thirdParty,
                method,
            },
        });

        let frameRule;

        /**
         * For Document and Subdocument requests, we match frame, because
         * these requests are first (in page lifecycle), but for other requests
         * we get the frame rule from tabsApi, assuming the frame rule is
         * already in the tab context.
         */
        if (isDocumentOrSubDocumentRequest) {
            frameRule = documentApi.matchFrame(frameUrl);
        } else {
            frameRule = tabsApi.getTabFrameRule(tabId);
        }

        const matchingResult = engineApi.matchRequest({
            requestUrl,
            frameUrl,
            requestType,
            frameRule,
            method,
        });

        if (!matchingResult) {
            return undefined;
        }

        requestContextStorage.update(requestId, { matchingResult });

        if (isDocumentOrSubDocumentRequest && !skipPrecalculation) {
            cosmeticFrameProcessor.precalculateCosmetics({
                tabId,
                frameId,
                parentFrameId,
                documentId: details.documentId,
                url: requestUrl,
                timeStamp: timestamp,
            });
        }

        /**
         * For a $replace rule, response will be undefined since we need to get
         * the response in order to actually apply $replace rules to it.
         */
        const response = RequestBlockingApi.getBlockingResponse({
            rule: matchingResult.getBasicResult(),
            popupRule: matchingResult.getPopupRule(),
            eventId,
            requestId,
            requestUrl,
            referrerUrl,
            requestType,
            contentType,
            tabId,
        });

        if (!response) {
            /**
             * Strip url by $removeparam rules.
             * $removeparam rules are applied after URL blocking rules.
             *
             * @see {@link https://github.com/AdguardTeam/CoreLibs/issues/1462}
             */
            const purgedUrl = paramsService.getPurgedUrl(requestId);

            if (purgedUrl) {
                return { redirectUrl: purgedUrl };
            }
        }

        if (response?.cancel) {
            tabsApi.incrementTabBlockedRequestCount(tabId, referrerUrl);

            const mainFrameUrl = tabsApi.getTabMainFrame(tabId)?.url;

            hideRequestInitiatorElement(
                tabId,
                requestFrameId,
                requestUrl,
                mainFrameUrl || referrerUrl,
                requestType,
                thirdParty,
            );
        } else {
            const frameContext = tabsApi.getFrameContext(tabId, frameId);

            // Note: In the code above, we pre-calculate cosmetics for the request,
            // which may update the frame context with the cosmetic result,
            // but it does not update the request context.
            // So we need to update the request context with the cosmetic result from the frame context, if needed.
            if (frameContext) {
                context.cosmeticResult = frameContext.cosmeticResult;
            }

            ContentFiltering.onBeforeRequest(context);
        }

        return response;
    }

    /**
     * On before send headers event handler.
     *
     * !IMPORTANT! This method modifies headers in the context. This non-pure action needs
     * to increase performance: exclude copying of headers for each service.
     *
     * @param details On before send headers details.
     * @param details.context Details context.
     *
     * @returns Web request event response.
     */
    private static onBeforeSendHeaders({
        context,
    }: RequestData<WebRequest.OnBeforeSendHeadersDetailsType>): WebRequestEventResponse {
        if (!context) {
            return undefined;
        }

        // If current request from the background - we don't need to modify headers,
        // only remove Cookie and immediately return modified headers
        const sanitizedRequest = SanitizeApi.onBeforeSendHeaders(context);
        if (sanitizedRequest) {
            return sanitizedRequest;
        }

        let requestHeadersModified = false;

        if (stealthApi.onBeforeSendHeaders(context)) {
            requestHeadersModified = true;
        }

        // If the current request does not comply with any rules - we do not
        // need to call any other processing services (e.g. cookie, header)
        if (context?.matchingResult) {
            if (cookieFiltering.onBeforeSendHeaders(context)) {
                requestHeadersModified = true;
            }

            if (removeHeadersService.onBeforeSendHeaders(context)) {
                requestHeadersModified = true;
            }
        }

        if (requestHeadersModified) {
            return { requestHeaders: context.requestHeaders };
        }

        return undefined;
    }

    /**
     * On headers received event handler.
     *
     * @param event On headers received event.
     * @param event.context Event context.
     * @param event.details On headers received details.
     *
     * @returns Web request event response.
     */
    private static onHeadersReceived({
        context,
        details,
    }: RequestData<WebRequest.OnHeadersReceivedDetailsType>): WebRequestEventResponse {
        if (!context) {
            return undefined;
        }

        defaultFilteringLog.publishEvent({
            type: FilteringEventType.ReceiveResponse,
            data: {
                tabId: context.tabId,
                eventId: context.eventId,
                statusCode: details.statusCode,
            },
        });

        if (!context?.matchingResult || context.matchingResult.getBasicResult()?.isFilteringDisabled()) {
            return undefined;
        }

        const {
            requestId,
            requestUrl,
            referrerUrl,
            requestType,
            contentType,
            responseHeaders,
            matchingResult,
            requestFrameId,
            thirdParty,
            tabId,
        } = context;

        const headerResult = matchingResult.getResponseHeadersResult(responseHeaders);

        const response = RequestBlockingApi.getResponseOnHeadersReceived(responseHeaders, {
            tabId,
            eventId: context.eventId,
            rule: headerResult,
            referrerUrl,
            requestUrl,
            requestId,
            requestType,
            contentType,
        });

        if (response?.cancel) {
            tabsApi.incrementTabBlockedRequestCount(tabId, referrerUrl);

            const mainFrameUrl = tabsApi.getTabMainFrame(tabId)?.url;

            hideRequestInitiatorElement(
                tabId,
                requestFrameId,
                requestUrl,
                mainFrameUrl || referrerUrl,
                requestType,
                thirdParty,
            );

            return response;
        }

        const contentTypeHeader = findHeaderByName(responseHeaders!, 'content-type')?.value;

        if (contentTypeHeader) {
            requestContextStorage.update(requestId, { contentTypeHeader });
        }

        let responseHeadersModified = false;

        if (requestUrl && (requestType === RequestType.Document || requestType === RequestType.SubDocument)) {
            if (cspService.onHeadersReceived(context)) {
                responseHeadersModified = true;
            }
            if (permissionsPolicyService.onHeadersReceived(context)) {
                responseHeadersModified = true;
            }
            if (TrustedTypesService.onHeadersReceived(context)) {
                responseHeadersModified = true;
            }
        }

        if (cookieFiltering.onHeadersReceived(context)) {
            responseHeadersModified = true;
        }

        if (removeHeadersService.onHeadersReceived(context)) {
            responseHeadersModified = true;
        }

        if (responseHeadersModified) {
            return { responseHeaders: context.responseHeaders };
        }

        return undefined;
    }

    /**
     * On response started event handler.
     *
     * @param event On response started event.
     * @param event.context Event context.
     */
    private static onResponseStarted({
        context,
    }: RequestData<WebRequest.OnResponseStartedDetailsType>): void {
        if (!context) {
            return;
        }

        const { tabId, frameId, requestType } = context;

        if (requestType !== RequestType.Document && requestType !== RequestType.SubDocument) {
            return;
        }

        CosmeticApi.applyJs(tabId, frameId);
    }

    /**
     * Handler for the last event in the request lifecycle.
     *
     * @param event The event that occurred upon completion of the request.
     * @param event.context The context of the completed event.
     * @param event.details The details of the completed event.
     */
    private static onCompleted({
        context,
        details,
    }: RequestData<WebRequest.OnCompletedDetailsType>): void {
        if (!context) {
            return;
        }

        const {
            requestType,
            tabId,
            frameId,
            requestUrl,
            timestamp,
            contentType,
        } = context;

        const isFirefox = browserDetectorMV2.isFirefox();

        /**
         * Trying to inject cosmetics for sub frames in Firefox as soon as possible
         * because webNavigation events (where we also inject cosmetics) can be fired too late. AG-40169.
         */
        if (isFirefox || requestType === RequestType.SubDocument) {
            WebRequestApi.injectCosmetic(details);
        }

        if (requestType === RequestType.Document || requestType === RequestType.SubDocument) {
            const frameContext = tabsApi.getFrameContext(tabId, frameId);
            if (!frameContext?.cosmeticResult) {
                logger.debug(`[tsweb.WebRequestApi.onCompleted]: cannot log script rules due to not having cosmetic result for tabId: ${tabId}, frameId: ${frameId}.`);
                return;
            }

            CosmeticApi.logScriptRules({
                tabId,
                cosmeticResult: frameContext.cosmeticResult,
                url: requestUrl,
                contentType,
                timestamp,
            });
        }

        WebRequestApi.deleteRequestContext(context.requestId);
    }

    /**
     * Deletes the request context immediately.
     *
     * @param requestId The ID of the request.
     */
    private static deleteRequestContext(requestId: string): void {
        requestContextStorage.delete(requestId);
    }

    /**
     * Event handler for onErrorOccurred event. It fires when an error occurs.
     *
     * @param event On error occurred event.
     * @param event.details On error occurred event details.
     */
    private static onErrorOccurred({
        details,
    }: RequestData<WebRequest.OnErrorOccurredDetailsType>): WebRequestEventResponse {
        WebRequestApi.deleteRequestContext(details.requestId);
    }

    /**
     * Injects cosmetic rules to specified frame based on tab id and frame id.
     *
     * @param details Event details.
     */
    private static injectCosmetic(
        details: WebNavigation.OnCommittedDetailsType
        | WebNavigation.OnDOMContentLoadedDetailsType
        | WebRequest.OnCompletedDetailsType,
    ): void {
        const {
            tabId,
            frameId,
        } = details;

        if (WebRequestApi.isAssistantFrame(tabId, details)) {
            logger.trace(`[tsweb.WebRequestApi.injectCosmetic]: assistant frame detected, skipping cosmetics injection for tabId ${tabId} and frameId: ${frameId}`);
            return;
        }

        CosmeticApi.injectCosmetic(tabId, frameId);
    }

    /**
     * On before navigate web navigation event handler.
     *
     * @param details Event details.
     */
    private static onBeforeNavigate(details: OnBeforeNavigateDetailsType): void {
        const {
            frameId,
            tabId,
            timeStamp,
            url,
            documentId,
            documentLifecycle,
            parentFrameId,
        } = details;

        // supported by Chrome 106+
        // but not supported by Firefox so it is calculated based on tabId and frameId
        // @ts-ignore
        let { parentDocumentId } = details;

        const isDocumentLevelFrame = TabsApi.isDocumentLevelFrame(parentFrameId);

        /**
         * Use parentDocumentId if it is defined, otherwise:
         * - if parent frame is a document-level frame, use undefined
         * - else generate parentDocumentId based on tabId and parentFrameId.
         */
        if (!parentDocumentId) {
            parentDocumentId = isDocumentLevelFrame
                ? undefined
                : TabsApi.generateId(tabId, parentFrameId);
        }

        /**
         * In some cases `onBeforeNavigate` might happen before Tabs API `onCreated`
         * event is fired or even not fired at all
         * (e.g. {@link https://github.com/microsoft/MicrosoftEdge-Extensions/issues/296 | Edge Split Screen Issue}),
         * in this cases we need to create tab context manually. This is needed
         * to ensure that we have tab context to be able to inject cosmetics and scripts.
         *
         * We create tab context only for document requests (outermost frame),
         * because other types of requests can't have tab context.
         */
        if (isDocumentLevelFrame) {
            tabsApi.createTabContextIfNotExists(tabId, url);
        }

        if (cosmeticFrameProcessor.shouldSkipRecalculation(tabId, frameId, url, timeStamp)) {
            return;
        }

        /**
         * Set in the beginning to let other events know that cosmetic result
         * will be calculated in this event to avoid double calculation.
         */
        tabsApi.setFrameContext(tabId, frameId, new FrameMV2({
            tabId,
            frameId,
            parentFrameId,
            url,
            timeStamp,
            documentId,
            parentDocumentId,
        }));

        // TODO: Check, should we record this event for filtering log.

        cosmeticFrameProcessor.precalculateCosmetics({
            tabId,
            frameId,
            parentFrameId,
            url,
            timeStamp,
            documentLifecycle,
            documentId,
            parentDocumentId,
        });
    }

    /**
     * On committed web navigation event handler.
     *
     * Injects necessary CSS and scripts into the web page.
     *
     * @param details Event details.
     */
    private static onCommitted(details: WebNavigation.OnCommittedDetailsType): void {
        const {
            tabId,
            frameId,
            // supported by Chrome 106+
            // but not supported by Firefox so it is calculated based on tabId and frameId
            // @ts-ignore
            documentId,
        } = details;

        // This is necessary mainly to update documentId
        tabsApi.updateFrameContext(
            tabId,
            frameId,
            {
                documentId: documentId || TabsApi.generateId(tabId, frameId),
            },
        );

        WebRequestApi.injectCosmetic(details);
    }

    /**
     * Checks whether the frame is an assistant frame.
     *
     * Needed to prevent cosmetic rules injection into the assistant frame.
     *
     * @param tabId Tab id.
     * @param details Event details.
     *
     * @returns True if the frame is an assistant frame, false otherwise.
     */
    private static isAssistantFrame(
        tabId: number,
        details: CommonAssistantDetails,
    ): boolean {
        const tabContext = tabsApi.getTabContext(tabId);

        return CommonAssistant.isAssistantFrame(details, tabContext);
    }

    /**
     * On DOM content loaded web navigation event handler.
     *
     * This method injects css and js code in all frames, particularly in iframes without remote source.
     * Usual webRequest callbacks don't fire for frames without remote source.
     * Also urls in these frames may be "about:blank", "about:srcdoc", etc.
     *
     * @see https://github.com/AdguardTeam/AdguardBrowserExtension/issues/1046
     *
     * @param details Event details.
     */
    private static onDomContentLoaded(details: WebNavigation.OnDOMContentLoadedDetailsType): void {
        const {
            tabId,
            frameId,
            // supported by Chrome 106+
            // but not supported by Firefox so it is calculated based on tabId and frameId
            // @ts-ignore
            documentId,
        } = details;

        // This is necessary mainly to update documentId
        tabsApi.updateFrameContext(
            tabId,
            frameId,
            {
                documentId: documentId || TabsApi.generateId(tabId, frameId),
            },
        );

        WebRequestApi.injectCosmetic(details);
    }

    /**
     * Intercepts csp_report requests.
     * Check the URL of the report.
     * For chromium and firefox:
     * If it's sent to a third party, block it right away.
     * For firefox only:
     * If it contains moz://extension with our extension ID, block it as well.
     *
     * @see https://github.com/AdguardTeam/AdguardBrowserExtension/issues/1792.
     *
     * @param details Request details.
     * @param details.context Request context.
     *
     * @returns Web request response or void if there is nothing to do.
     */
    private static onBeforeCspReport(
        { context }: RequestData<WebRequest.OnBeforeRequestDetailsType>,
    ): WebRequestEventResponse {
        // If filtering is disabled - skip process request.
        if (!engineApi.isFilteringEnabled) {
            return undefined;
        }

        if (!context) {
            return undefined;
        }

        const {
            requestType,
            matchingResult,
            tabId,
            eventId,
            referrerUrl,
            thirdParty,
        } = context;

        /**
         * Checks request type here instead of creating two event listener with
         * different filter types via {@link RequestEvent.init} to simplify
         * event handlers flow and create only one {@link RequestEvents.onBeforeRequest}
         * listener and two WebRequest listeners: {@link WebRequestApi.onBeforeCspReport}
         * and {@link WebRequestApi.onBeforeRequest}.
         */
        if (requestType !== RequestType.CspReport) {
            return undefined;
        }

        // If filtering disabled for this request.
        if (matchingResult?.getBasicResult()?.isFilteringDisabled()) {
            return undefined;
        }

        if (thirdParty) {
            defaultFilteringLog.publishEvent({
                type: FilteringEventType.CspReportBlocked,
                data: {
                    tabId,
                    eventId,
                    cspReportBlocked: true,
                },
            });

            tabsApi.incrementTabBlockedRequestCount(tabId, referrerUrl);

            return { cancel: true };
        }

        // Don't check for moz://extension because it was fixed in
        // https://bugzilla.mozilla.org/show_bug.cgi?id=1588957#c10.
        return undefined;
    }

    /**
     * Delete frame data from tab context when navigation is finished.
     *
     * @param details Navigation event details.
     */
    private static deleteFrameContext(
        details: WebNavigation.OnCompletedDetailsType | WebNavigation.OnErrorOccurredDetailsType,
    ): void {
        const { tabId, frameId } = details;

        setTimeout(() => {
            tabsApi.deleteFrameContext(tabId, frameId, FRAME_DELETION_TIMEOUT_MS);
        }, FRAME_DELETION_TIMEOUT_MS);
    }

    /**
     * On committed web navigation event handler only for Opera.
     *
     * There is Opera bug that prevents firing WebRequest events for document
     * and subdocument requests.
     * We now handle this by checking if matching result exists for main frame
     * and if not - we force create it.
     *
     * TODO: remove this when Opera bug is fixed.
     *
     * @param details Event details.
     */
    private static onCommittedOperaHook(details: WebNavigation.OnCommittedDetailsType): void {
        const {
            frameId,
            tabId,
            url,
        } = details;

        const isOpera = browserDetectorMV2.isOpera();

        if (isOpera && frameId === MAIN_FRAME_ID) {
            const tabContext = tabsApi.getTabContext(tabId);
            if (!tabContext) {
                return;
            }

            const frame = tabContext.frames.get(frameId);
            if (!frame || frame.matchingResult) {
                return;
            }

            const matchingResult = engineApi.matchRequest({
                requestUrl: url,
                frameUrl: url,
                requestType: RequestType.Document,
                frameRule: tabContext.mainFrameRule,
            });

            frame.matchingResult = matchingResult;
        }
    }
}
