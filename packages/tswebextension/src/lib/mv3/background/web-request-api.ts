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
 * Applying {@link NetworkRule} from the background page:
 *
 * The cssText and scriptText for specified request are calculated and stored in context storages,
 * at the time {@link RequestEvents.onBeforeRequest} is processed.
 *
 * At {@link RequestEvents.onBeforeSendHeaders}, the request headers will be parsed to apply $cookie rules
 * based on the {@link MatchingResult} stored in {@link requestContextStorage}.
 * At {@link RequestEvents.onHeadersReceived}, the response headers are handled in the same way.
 *
 * At {@link RequestEvents.onErrorOccurred}, the blocked request url will be matched by {@link companiesDbService}
 * for collecting precise statistics of blocked requests.
 *
 * The specified {@link RequestContext} will be removed from {@link requestContextStorage}
 * on {@link WebNavigation.onCommitted} after injection or {@link RequestEvents.onErrorOccurred} events.
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
import browser, { type WebRequest, type WebNavigation } from 'webextension-polyfill';

import { RequestType } from '@adguard/tsurlfilter/es/request-type';

import { getDomain, isExtensionUrl, isHttpOrWsRequest } from '../../common/utils/url';
import { RequestEvents } from './request/events/request-events';
import { type RequestData } from './request/events/request-event';
import { cookieFiltering } from './services/cookie-filtering/cookie-filtering';
import { engineApi } from './engine-api';
import { tabsApi } from '../tabs/tabs-api';
import { requestContextStorage } from './request/request-context-storage';
import { DocumentApi } from './document-api';
import { CosmeticApi } from './cosmetic-api';
import { getErrorMessage } from '../../common/error';
import { BACKGROUND_TAB_ID, FRAME_DELETION_TIMEOUT_MS, MAIN_FRAME_ID } from '../../common/constants';
import { defaultFilteringLog, FilteringEventType } from '../../common/filtering-log';
import { logger } from '../../common/utils/logger';
import { RequestBlockingApi } from './request/request-blocking-api';
import { companiesDbService } from '../../common/companies-db-service';
import { CspService } from './services/csp-service';
import { PermissionsPolicyService } from './services/permissions-policy-service';

/**
 * API for applying rules from background service by handling
 * Web Request API and web navigation events.
 *
 * Calculates matchingResult and cosmeticResult and saves them to the cache
 * related to pair tabId+documentId to save execution time of future requests
 * cosmetic rules from content-script.
 */
export class WebRequestApi {
    /**
     * Value of the parent frame id if no parent frame exists.
     *
     * @see {@link WebRequest.OnBeforeRequestDetailsType#parentFrameId}
     */
    private static readonly NO_PARENT_FRAME_ID = -1;

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
        browser.webNavigation.onBeforeNavigate.addListener(WebRequestApi.onBeforeNavigate);
        browser.webNavigation.onCommitted.addListener(WebRequestApi.onCommitted);
        browser.webNavigation.onErrorOccurred.addListener(WebRequestApi.deleteFrameContext);
        browser.webNavigation.onCompleted.addListener(WebRequestApi.deleteFrameContext);
    }

    /**
     * Removes web request event handlers.
     */
    public static stop(): void {
        // browser.webRequest Events
        RequestEvents.onBeforeRequest.removeListener(WebRequestApi.onBeforeRequest);
        RequestEvents.onBeforeSendHeaders.removeListener(WebRequestApi.onBeforeSendHeaders);
        RequestEvents.onHeadersReceived.removeListener(WebRequestApi.onHeadersReceived);
        RequestEvents.onErrorOccurred.removeListener(WebRequestApi.onErrorOccurred);
        RequestEvents.onCompleted.removeListener(WebRequestApi.onCompleted);

        // browser.webNavigation Events
        browser.webNavigation.onBeforeNavigate.removeListener(WebRequestApi.onBeforeNavigate);
        browser.webNavigation.onCommitted.removeListener(WebRequestApi.onCommitted);
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

        // TODO: In getBlockingResponse we need extract requestType from context
        // to save it for filtering log. Check, if we really need this in MV3.
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

        if (!isHttpOrWsRequest(requestUrl)) {
            return;
        }

        // We do not check for exists request context here (as it was in MV2),
        // because in MV3 $removeparam rules are applied by browser and does not
        // require page reload after the applying.
        if (requestType === RequestType.Document) {
            // dispatch filtering log reload event
            defaultFilteringLog.publishEvent({
                type: FilteringEventType.TabReload,
                data: { tabId },
            });
        }

        defaultFilteringLog.publishEvent({
            type: FilteringEventType.SendRequest,
            data: {
                tabId,
                eventId,
                requestUrl,
                requestDomain: getDomain(requestUrl),
                frameUrl: referrerUrl,
                frameDomain: getDomain(referrerUrl),
                requestType: contentType,
                timestamp,
                requestThirdParty: thirdParty,
                method,
            },
        });

        let frameRule = null;
        if (requestType === RequestType.SubDocument) {
            frameRule = DocumentApi.matchFrame(referrerUrl);
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

            const scriptText = CosmeticApi.getScriptText(cosmeticResult, requestUrl || referrerUrl);
            const cssText = CosmeticApi.getCssText(cosmeticResult);

            requestContextStorage.update(requestId, {
                cosmeticResult,
                scriptText,
                cssText,
            });
        }

        const basicResult = result.getBasicResult();

        const response = RequestBlockingApi.getBlockingResponse({
            rule: basicResult,
            popupRule: result.getPopupRule(),
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
     */
    private static onResponseStarted({ context }: RequestData<WebRequest.OnResponseStartedDetailsType>): void {
        if (!context) {
            return;
        }

        const { requestId, requestType } = context;

        if (requestType !== RequestType.Document
            && requestType !== RequestType.SubDocument) {
            return;
        }

        CosmeticApi.applyJsByRequest(requestId);
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
    private static onBeforeNavigate(details: WebNavigation.OnBeforeNavigateDetailsType): void {
        const { frameId, tabId, url } = details;

        if (frameId === MAIN_FRAME_ID) {
            tabsApi.handleTabNavigation(tabId, url);
        }
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
            referrerUrl,
            contentType,
        } = context;

        // TODO: we consider that only we block requests,
        // so we do not care (for now) if the request is blocked by other browser extension.
        // it may be handled by checking the matchingResult in the context.

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
                isAllowlist: false,
                isImportant: false,
                isDocumentLevel: parentFrameId === WebRequestApi.NO_PARENT_FRAME_ID,
                isCsp: false,
                isCookie: false,
                advancedModifier: null,
            },
        });

        requestContextStorage.delete(requestId);
    }

    /**
     * Event handler for onErrorOccurred event. It fires when an error occurs.
     *
     * @param event On error occurred event.
     * @param event.context On completed occurred event context.
     */
    private static onCompleted({
        context,
    }: RequestData<WebRequest.OnCompletedDetailsType>): void {
        if (!context) {
            return;
        }

        const {
            requestType,
            tabId,
            requestUrl,
            timestamp,
            contentType,
            cosmeticResult,
        } = context;

        if (cosmeticResult
            && (requestType === RequestType.Document || requestType === RequestType.SubDocument)) {
            CosmeticApi.logScriptRules({
                tabId,
                cosmeticResult,
                url: requestUrl,
                contentType,
                timestamp,
            });
        }

        requestContextStorage.delete(context.requestId);
    }

    /**
     * Delete frame data from tab context when navigation is finished.
     * @param details Navigation event details.
     */
    private static deleteFrameContext(
        details: WebNavigation.OnCompletedDetailsType | WebNavigation.OnErrorOccurredDetailsType,
    ): void {
        const { tabId, frameId } = details;

        setTimeout(() => {
            requestContextStorage.deleteByTabAndFrame(tabId, frameId);
        }, FRAME_DELETION_TIMEOUT_MS);

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
        setTimeout(() => tabContext.frames.delete(frameId), FRAME_DELETION_TIMEOUT_MS);
    }

    /**
     * On WebNavigation.onCommitted event we will try to inject scripts into tab.
     *
     * @param details Navigation event details.
     */
    private static onCommitted(details: browser.WebNavigation.OnCommittedDetailsType): void {
        const { tabId, frameId } = details;

        // Note: this is an async function, but we will not await it because
        // events do not support async listeners.
        Promise.all([
            CosmeticApi.applyJsByTabAndFrame(tabId, frameId),
            CosmeticApi.applyCssByTabAndFrame(tabId, frameId),
        ]).catch((e) => logger.error(e));
    }
}
