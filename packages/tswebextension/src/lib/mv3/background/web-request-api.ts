/**
 * @file
 * API for applying rules from background service
 * by handling web Request API and web navigation events.
 *
 * This scheme describes flow for MV3.
 *
 * Event data is aggregated into two contexts: {@link RequestContext},
 * which contains data about the specified request
 * and {@link TabContext} which contains data about the specified tab and frames inside it.
 *
 * Applying {@link NetworkRule} from the background page:
 *
 * In case if {@link browser.tabs.onCreated} event is not fired before —
 * we create a {@link TabContext} manually for document requests,
 * and the cssText, scriptText, scriptletDataList for specified frame are calculated and stored in tab context storage,
 * at the time {@link RequestEvents.onBeforeRequest} or {@link WebNavigation.onBeforeNavigate} is processed.
 * In the most cases the onBeforeNavigate event is processed before onBeforeRequest.
 *
 * At {@link RequestEvents.onBeforeSendHeaders}, the request headers will be parsed to apply $cookie rules
 * based on the {@link MatchingResult} stored in {@link requestContextStorage}.
 * At {@link RequestEvents.onHeadersReceived}, the response headers are handled in the same way.
 *
 * At {@link RequestEvents.onErrorOccurred}, the blocked request url will be matched by {@link companiesDbService}
 * for collecting precise statistics of blocked requests.
 *
 * The specified {@link RequestContext} or frame context {@link Frame} will be removed from the storage
 * on {@link WebNavigation.onCommitted} after injection or {@link RequestEvents.onErrorOccurred} events.
 *
 *
 * Web Request API Event Handling:
 *
 *                                       ┌─────────────────────────────┐
 * Create {@link TabContext}             │                             │
 * if it's not created before,           │       onBeforeRequest       ◄─┐
 * and matches {@link MatchingResult}    │                             │ │
 * for the request.                      └──────────────┬──────────────┘ │
 * If this is a frame request,                          │                │
 * also matches the                                     │                │
 * {@link CosmeticResult}                               │                │
 *                                                      │                │
 *                                                      │                │
 *                                       ┌──────────────▼──────────────┐ │
 * Parses request headers and applies    │                             │ │
 * $cookie rules based on                │      onBeforeSendHeaders    ◄─┼─┐
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
 * Parses response headers and applies   │                             │ │ │
 * $cookie rules based on              ┌─┤      onHeadersReceived      │ │ │
 * {@link MatchingResult}.             │ │                             │ │ │
 *                                     │ └─────────────────────────────┘ │ │
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
 *   On response started               │ ┌─────────────────────────────┐
 *   We try to inject js               │ │                             │
 *                                     └─►      onResponseStarted      │
 *                                       │                             │
 *                                       └──────────────┬──────────────┘
 *                                                      │
 *                                       ┌──────────────▼──────────────┐
 *                                       │                             │
 * Removes the request information       │         onCompleted         │
 * from {@link requestContextStorage}.   │                             │
 *                                       └─────────────────────────────┘.
 *
 *                                       ┌─────────────────────────────┐
 * Matches blocked request url           │                             │
 * by {@link companiesDbService}         │                             │
 * for collecting statistics.            │       onErrorOccurred       │
 * Also removes the request information  │                             │
 * from {@link requestContextStorage}.   │                             │
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
 * and matches {@link CosmeticResult}                   │
 *                                                      │
 *                                                      │
 *                                       ┌──────────────▼──────────────┐
 * Try injecting js and css              │                             │
 * into the frame with source            │         onCommitted         │
 * based on {@link CosmeticRule}.        │                             │
 * and remove data from the              └──────────────┬──────────────┘
 * {@link RequestContextStorage}                        │
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
import browser, { type WebNavigation, type WebRequest } from 'webextension-polyfill';
import { RequestType } from '@adguard/tsurlfilter';

import { CommonAssistant, type CommonAssistantDetails } from '../../common/assistant';
import { companiesDbService } from '../../common/companies-db-service';
import { BACKGROUND_TAB_ID, FRAME_DELETION_TIMEOUT_MS } from '../../common/constants';
import { defaultFilteringLog, FilteringEventType } from '../../common/filtering-log';
import { logger } from '../../common/utils/logger';
import { getDomain, isExtensionUrl, isHttpOrWsRequest } from '../../common/utils/url';
import { TabsApiCommon } from '../../common/tabs/tabs-api';
import { tabsApi } from '../tabs/tabs-api';
import { FrameMV3 } from '../tabs/frame';

import { CosmeticApi } from './cosmetic-api';
import { CosmeticFrameProcessor } from './cosmetic-frame-processor';
import { declarativeFilteringLog } from './declarative-filtering-log';
import { DocumentApi } from './document-api';
import { engineApi } from './engine-api';
import { type OnBeforeRequestDetailsType, RequestEvents } from './request/events/request-events';
import { RequestBlockingApi } from './request/request-blocking-api';
import { requestContextStorage } from './request/request-context-storage';
import { type RequestData } from './request/events/request-event';
import { cookieFiltering } from './services/cookie-filtering/cookie-filtering';
import { CspService } from './services/csp-service';
import { PermissionsPolicyService } from './services/permissions-policy-service';
import { StealthService } from './services/stealth-service';
import { UserScriptsApi } from './user-scripts-api';
import { documentBlockingService } from './services/document-blocking-service';

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
        RequestEvents.onResponseStarted.addListener(WebRequestApi.onResponseStarted);
        RequestEvents.onBeforeSendHeaders.addListener(WebRequestApi.onBeforeSendHeaders);
        RequestEvents.onHeadersReceived.addListener(WebRequestApi.onHeadersReceived);
        RequestEvents.onErrorOccurred.addListener(WebRequestApi.onErrorOccurred);
        RequestEvents.onCompleted.addListener(WebRequestApi.onCompleted);

        // browser.webNavigation Events
        // 'chrome' is used here because MV3 is mainly for Chrome,
        // and it provides better types compared to 'browser' from webextension-polyfill.
        chrome.webNavigation.onBeforeNavigate.addListener(WebRequestApi.onBeforeNavigate);
        chrome.webNavigation.onCommitted.addListener(WebRequestApi.onCommitted);
        browser.webNavigation.onErrorOccurred.addListener(WebRequestApi.deleteFrameContext);
        browser.webNavigation.onCompleted.addListener(WebRequestApi.deleteFrameContext);
    }

    /**
     * Removes web request event handlers.
     */
    public static stop(): void {
        // browser.webRequest Events
        RequestEvents.onBeforeRequest.removeListener(WebRequestApi.onBeforeRequest);
        RequestEvents.onResponseStarted.removeListener(WebRequestApi.onResponseStarted);
        RequestEvents.onBeforeSendHeaders.removeListener(WebRequestApi.onBeforeSendHeaders);
        RequestEvents.onHeadersReceived.removeListener(WebRequestApi.onHeadersReceived);
        RequestEvents.onErrorOccurred.removeListener(WebRequestApi.onErrorOccurred);
        RequestEvents.onCompleted.removeListener(WebRequestApi.onCompleted);

        // browser.webNavigation Events
        chrome.webNavigation.onBeforeNavigate.removeListener(WebRequestApi.onBeforeNavigate);
        chrome.webNavigation.onCommitted.removeListener(WebRequestApi.onCommitted);
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
            logger.error('[tsweb.WebRequestApi.flushMemoryCache]: Cannot flush memory cache and call browser.handlerBehaviorChanged: ', e);
        }
    }

    /**
     * On before request event handler. This is the earliest event in the chain of the web request events.
     *
     * @param requestData Object containing request context and details.
     * @param requestData.context Request context.
     * @param requestData.details Event details.
     */
    private static onBeforeRequest(
        { context, details }: RequestData<OnBeforeRequestDetailsType>,
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
            eventId,
            contentType,
            timestamp,
            thirdParty,
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
            skipPrecalculation = CosmeticFrameProcessor.shouldSkipRecalculation(
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
                tabsApi.setFrameContext(tabId, frameId, new FrameMV3({
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
            return;
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
                frameDomain: getDomain(referrerUrl),
                requestType: contentType,
                timestamp,
                requestThirdParty: thirdParty,
                method,
            },
        });

        let frameRule;

        /**
         * For Document and SubDocument requests, we match frame, because
         * these requests are happening first in page's lifecycle (before other).
         *
         * For other requests we get the frame rule from tabsApi, assuming
         * the frame rule is already in the tab context.
         */
        if (isDocumentOrSubDocumentRequest) {
            frameRule = DocumentApi.matchFrame(frameUrl);
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
            return;
        }

        // Save matching result to the request context.
        requestContextStorage.update(requestId, { matchingResult });
        if (isDocumentOrSubDocumentRequest && !skipPrecalculation) {
            // Matching request
            CosmeticFrameProcessor.precalculateCosmetics({
                tabId,
                frameId,
                parentFrameId,
                url: requestUrl,
                timeStamp: timestamp,
            });
        }

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

        // redirects should be considered as blocked for the tab blocked request count
        // which is displayed on the extension badge
        // https://github.com/AdguardTeam/AdguardBrowserExtension/issues/2443
        if (response?.cancel || response?.redirectUrl !== undefined) {
            tabsApi.incrementTabBlockedRequestCount(tabId, referrerUrl);
        }
    }

    /**
     * On response started event handler.
     *
     * @param event On response started event.
     * @param event.context Event context.
     * @param event.details Event details.
     */
    private static onResponseStarted(
        { context, details }: RequestData<WebRequest.OnResponseStartedDetailsType>,
    ): void {
        if (!context) {
            return;
        }

        const { requestType, tabId, frameId } = context;

        if (requestType !== RequestType.Document
            && requestType !== RequestType.SubDocument) {
            return;
        }

        if (WebRequestApi.isAssistantFrame(tabId, details)) {
            logger.debug(`[tsweb.WebRequestApi.onResponseStarted]: assistant frame detected, skipping cosmetics injection for tabId ${tabId} and frameId ${frameId}`);
            return;
        }

        if (!CosmeticApi.shouldApplyCosmetics(tabId, details.url)) {
            logger.debug(`[tsweb.WebRequestApi.onResponseStarted]: skipping cosmetics injection for background or extension page with tabId ${tabId}, frameId ${frameId} and url ${details.url}`);
            return;
        }

        if (UserScriptsApi.isSupported) {
            CosmeticApi.applyJsFuncsAndScriptletsByTabAndFrame(tabId, frameId);
        } else {
            CosmeticApi.applyJsFuncsByTabAndFrame(tabId, frameId);
            CosmeticApi.applyScriptletsByTabAndFrame(tabId, frameId);
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

        StealthService.onBeforeSendHeaders(context);
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
        if (!context) {
            return;
        }

        defaultFilteringLog.publishEvent({
            type: FilteringEventType.ReceiveResponse,
            data: {
                tabId: context.tabId,
                // It's important to use same eventId as onBeforeRequest to match
                // the request in the filtering log and update it's status.
                eventId: context.eventId,
                statusCode: details.statusCode,
            },
        });

        const { requestUrl, requestType } = context;

        if (requestUrl && (requestType === RequestType.Document || requestType === RequestType.SubDocument)) {
            CspService.onHeadersReceived(context);

            PermissionsPolicyService.onHeadersReceived(context);
        }

        cookieFiltering.onHeadersReceived(context);
    }

    /**
     * On before navigate web navigation event handler.
     *
     * @param details Event details.
     */
    private static onBeforeNavigate(
        details: chrome.webNavigation.WebNavigationParentedCallbackDetails,
    ): void {
        const {
            tabId,
            frameId,
            parentFrameId,
            url,
            parentDocumentId,
            timeStamp,
        } = details;

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
        if (TabsApiCommon.isDocumentLevelFrame(parentFrameId)) {
            tabsApi.createTabContextIfNotExists(tabId, url);
        }

        if (CosmeticFrameProcessor.shouldSkipRecalculation(tabId, frameId, url, timeStamp)) {
            return;
        }

        /**
         * Set in the beginning to let other events know that cosmetic result
         * will be calculated in this event to avoid double calculation.
         */
        tabsApi.setFrameContext(tabId, frameId, new FrameMV3({
            tabId,
            frameId,
            parentFrameId,
            url,
            timeStamp,
            documentId: details.documentId,
            parentDocumentId: details.parentDocumentId,
        }));

        // Matching request
        CosmeticFrameProcessor.precalculateCosmetics({
            tabId,
            frameId,
            parentFrameId,
            url,
            timeStamp,
            parentDocumentId,
        });
    }

    /**
     * Event handler for onErrorOccurred event. It fires when an error occurs, e.g. request is blocked.
     * So if the request is blocked by DNR rule,
     * we should log this event for collecting statistics due to {@link companiesDbService}.
     *
     * @param event On error occurred event.
     * @param event.details On error occurred event details.
     */
    private static onErrorOccurred({
        details,
    }: RequestData<WebRequest.OnErrorOccurredDetailsType>): void {
        const {
            tabId,
            requestId,
            url,
            type,
            parentFrameId,
            error,
        } = details;

        /**
         * Error related to request blocking by DNR rule.
         */
        const CLIENT_BLOCKED_ERROR = 'net::ERR_BLOCKED_BY_CLIENT';

        // filter out non-related errors, e.g. 'net::ERR_ABORTED'
        if (error !== CLIENT_BLOCKED_ERROR) {
            return;
        }

        const context = requestContextStorage.get(requestId);

        if (!context) {
            return;
        }

        const {
            eventId,
            requestUrl,
            referrerUrl,
            contentType,
            matchingResult,
        } = context;

        // checking whether the matchingResult exists in the context guarantees
        // that the request was blocked by our extension
        if (!matchingResult) {
            return;
        }

        const companyCategoryName = companiesDbService.match(url);

        defaultFilteringLog.publishEvent({
            type: FilteringEventType.ApplyBasicRule,
            data: {
                tabId,
                eventId,
                requestType: contentType,
                frameUrl: referrerUrl,
                requestId,
                requestUrl: url,
                companyCategoryName,
                filterId: null,
                ruleIndex: null,
                isAllowlist: false,
                isImportant: false,
                isDocumentLevel: TabsApiCommon.isDocumentLevelFrame(parentFrameId),
                isCsp: false,
                isCookie: false,
                advancedModifier: null,
                isAssuredlyBlocked: true,
            },
        });

        WebRequestApi.deleteRequestContext(details.requestId);

        /**
         * Top-level frame request type.
         *
         * @see {@link https://developer.mozilla.org/docs/Mozilla/Add-ons/WebExtensions/API/webRequest/ResourceType#main_frame}
         */
        const MAIN_FRAME_TYPE = 'main_frame';
        if (type !== MAIN_FRAME_TYPE) {
            return;
        }

        const rule = matchingResult.getBasicResult();
        if (!rule) {
            return;
        }

        documentBlockingService.handleDocumentBlocking({
            eventId,
            requestUrl,
            requestId,
            referrerUrl,
            rule,
            tabId,
        });
    }

    /**
     * Handler for the last event in the request lifecycle.
     *
     * @param event The event that occurred upon completion of the request.
     * @param event.context The context of the completed event.
     */
    private static onCompleted({
        context,
    }: RequestData<WebRequest.OnCompletedDetailsType>): void {
        if (!context) {
            return;
        }

        const {
            tabId,
            frameId,
            requestUrl,
            requestType,
            contentType,
            timestamp,
        } = context;

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
     * Deletes the request context immediately or after a timeout,
     * depending on whether declarativeFilteringLog is listening.
     *
     * @param requestId The ID of the request.
     */
    private static deleteRequestContext(requestId: string): void {
        // If declarativeFilteringLog is listening, wait for a specified timeout
        // before deleting the request context to extract the context event ID,
        // allowing the request to be linked with the matched declarative rule.
        if (declarativeFilteringLog.isListening) {
            setTimeout(() => {
                requestContextStorage.delete(requestId);
            }, FRAME_DELETION_TIMEOUT_MS);
        } else {
            requestContextStorage.delete(requestId);
        }
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
     * On WebNavigation.onCommitted event we will try to inject scripts into tab.
     *
     * @param details Navigation event details.
     */
    private static onCommitted(details: chrome.webNavigation.WebNavigationFramedCallbackDetails): void {
        const { tabId, frameId, documentId } = details;

        // This is necessary mainly to update documentId
        tabsApi.updateFrameContext(tabId, frameId, { documentId });

        if (WebRequestApi.isAssistantFrame(tabId, details)) {
            logger.debug(`[tsweb.WebRequestApi.onCommitted]: assistant frame detected, skipping cosmetics injection for tabId ${tabId} and frameId: ${frameId}`);
            return;
        }

        if (!CosmeticApi.shouldApplyCosmetics(tabId, details.url)) {
            logger.debug(`[tsweb.WebRequestApi.onCommitted]: Skipping cosmetics injection for background or extension page with tabId ${tabId}, frameId ${frameId} and url ${details.url}`);
            return;
        }

        const tasks = [
            CosmeticApi.applyCssByTabAndFrame(tabId, frameId),
        ];

        if (UserScriptsApi.isSupported) {
            tasks.push(CosmeticApi.applyJsFuncsAndScriptletsByTabAndFrame(tabId, frameId));
        } else {
            tasks.push(CosmeticApi.applyJsFuncsByTabAndFrame(tabId, frameId));
            tasks.push(CosmeticApi.applyScriptletsByTabAndFrame(tabId, frameId));
        }

        // Note: this is an async function, but we will not await it because
        // events do not support async listeners.
        Promise.all(tasks).catch((e) => {
            logger.error('[tsweb.WebRequestApi.onCommitted]: error on cosmetics injection: ', e);
        });
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
}
