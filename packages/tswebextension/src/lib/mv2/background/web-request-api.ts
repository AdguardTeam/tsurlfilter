/**
 * @file
 * API for applying rules from background service
 * by handling web Request API and web navigation events.
 *
 * Event data is aggregated into two contexts: {@link RequestContext},
 * which contains data about the specified request
 * and {@link TabContext} which contains data about the specified tab.
 *
 *
 *  Applying {@link NetworkRule} from the background page:
 *
 * The {@link MatchingResult} of specified request is calculated and stored in context storages,
 * at the time {@link RequestEvents.onBeforeRequest} is processed.
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
 * The specified {@link RequestContext} will be removed from {@link requestContextStorage}
 * on {@link RequestEvents.onCompleted} or {@link RequestEvents.onErrorOccurred} events.
 *
 *
 *  Applying {@link CosmeticRule} from the background page.
 *
 * We calculate {@link CosmeticResult} and store it in {@link TabContext} context
 * at the time {@link RequestEvents.onBeforeRequest} is processed.
 *
 * To get the scripts up and running as quickly as possible
 * we try to inject them the first time during the {@link RequestEvents.onResponseStarted}.
 *
 * All cosmetic rules are then injected on the {@link browser.webNavigation.onCommitted} event.
 *
 * In Firefox, {@link browser.webNavigation.onCommitted} may not work for child frames,
 * so we also try to inject cosmetic rules on {@link RequestEvents.onCompleted}.
 *
 * For frames without a source, we inject cosmetics on the {@link browser.webNavigation.onDOMContentLoaded} event.
 *
 * The frame data will be removed from the specified {@link TabContext} on {@link browser.webNavigation.onCompleted} or
 * {@link browser.webNavigation.onErrorOccurred } events.
 *
 *  Web Request API Event Handling:
 *
 *                                       ┌─────────────────────────────┐
 * Matches {@link MatchingResult}        │                             │
 * for the request.                      │       onBeforeRequest       ◄─┐
 * If this is a frame request,           │                             │ │
 * also matches the                      └──────────────┬──────────────┘ │
 * {@link CosmeticResult}                               │                │
 * for the specified frame.                             │                │
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
 * headers based on                      │      onBeforeSendHeaders    ◄─┼┐
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
 * Removes or modifies response          │                             │ ││
 * headers based on                    ┌─┤      onHeadersReceived      │ ││
 * {@link MatchingResult}.             │ │                             │ ││
 * Modifies 'trusted-types' directive  │ └─────────────────────────────┘ ││
 * for CSP headers:                    │                                 ││.
 * @see {@link TrustedTypesService}.   │                                 ││
 *                                     │                                 ││
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
 * Try injecting JS rules into the     │ │                             │
 * frame based on                      └─►      onResponseStarted      │
 * {@link CosmeticRule}.                 │                             │
 *                                       └──────────────┬──────────────┘
 *                                                      │
 *                                       ┌──────────────▼──────────────┐
 * In Firefox, try injecting the         │                             │
 * CSS and JS into the                   │         onCompleted         │
 * subdocument frame based on            │                             │
 * {@link CosmeticResult}.               └─────────────────────────────┘
 * Remove the request information
 * from {@link requestContextStorage}.
 *
 *                                       ┌─────────────────────────────┐
 * Remove the request information        │                             │
 * from {@link requestContextStorage}.   │       onErrorOccurred       │
 *                                       │                             │
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
 * Try injecting CSS and JS rules        │                             │
 * into the frame with source            │         onCommitted         │
 * based on {@link CosmeticRule}.        │                             │
 *                                       └──────────────┬──────────────┘
 *                                                      │
 *                                       ┌──────────────▼──────────────┐
 * Try injecting CSS and JS rules        │                             │
 * into the subdocument frame            │      onDOMContentLoaded     ├─┐
 * without source based on               │                             │ │
 * {@link CosmeticRule}.                 └──────────────┬──────────────┘ │
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
import browser, { WebRequest, WebNavigation } from 'webextension-polyfill';
import { RequestType } from '@adguard/tsurlfilter/es/request-type';

import { tabsApi, engineApi } from './api';
import { Frame, MAIN_FRAME_ID } from './tabs/frame';
import { findHeaderByName } from '../../common/utils/find-header-by-name';
import { isHttpOrWsRequest, getDomain } from '../../common/utils/url';
import { logger } from '../../common/utils/logger';
import { defaultFilteringLog, FilteringEventType } from '../../common/filtering-log';
import { FRAME_DELETION_TIMEOUT } from '../../common/constants';

import { removeHeadersService } from './services/remove-headers-service';
import { CosmeticApi } from './cosmetic-api';
import { paramsService } from './services/params-service';
import { cookieFiltering } from './services/cookie-filtering/cookie-filtering';
import { ContentFiltering } from './services/content-filtering/content-filtering';
import { cspService } from './services/csp-service';
import { permissionsPolicyService } from './services/permissions-policy-service';
import { TrustedTypesService } from './services/trusted-types-service';

import {
    hideRequestInitiatorElement,
    RequestEvents,
    RequestData,
    requestContextStorage,
    RequestBlockingApi,
} from './request';
import { stealthApi } from './stealth-api';
import { SanitizeApi } from './sanitize-api';
import { isFirefox, isOpera } from './utils/browser-detector';
import { isLocalFrame } from './utils/is-local-frame';

export type WebRequestEventResponse = WebRequest.BlockingResponseOrPromise | void;

export type InjectCosmeticParams = {
    frameId: number,
    tabId: number,
    timestamp: number,
    url: string,
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
            // TODO: use getErrorMessage instead
            const message = e instanceof Error ? e.message : String(e);
            logger.error(message);
        }
    }

    /**
     * On before request event handler. This is the earliest event in the chain of the web request events.
     *
     * @param details Request details.
     * @param details.context Request context.
     * @returns Web request response or void if there is nothing to do.
     */
    private static onBeforeRequest(
        { context }: RequestData<WebRequest.OnBeforeRequestDetailsType>,
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

        if (!isHttpOrWsRequest(requestUrl)) {
            return undefined;
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

        const result = engineApi.matchRequest({
            requestUrl,
            frameUrl: referrerUrl,
            requestType,
            frameRule: tabsApi.getTabFrameRule(tabId),
            method,
        });

        if (!result) {
            return undefined;
        }

        requestContextStorage.update(requestId, {
            matchingResult: result,
        });

        if (requestType === RequestType.Document || requestType === RequestType.SubDocument) {
            tabsApi.handleFrameMatchingResult(tabId, frameId, result);

            const cosmeticOption = result.getCosmeticOption();

            const cosmeticResult = engineApi.getCosmeticResult(requestUrl, cosmeticOption);

            tabsApi.handleFrameCosmeticResult(tabId, frameId, cosmeticResult);

            requestContextStorage.update(requestId, {
                cosmeticResult,
            });
        }

        const basicResult = result.getBasicResult();

        // For a $replace rule, response will be undefined since we need to get
        // the response in order to actually apply $replace rules to it.
        const response = RequestBlockingApi.getBlockingResponse({
            rule: basicResult,
            eventId,
            requestUrl,
            referrerUrl,
            requestType,
            contentType,
            tabId,
        });

        if (!response) {
            /*
             Strip url by $removeparam rules
             $removeparam rules are applied after URL blocking rules
             https://github.com/AdguardTeam/CoreLibs/issues/1462
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

        if (!context?.matchingResult) {
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

        const {
            tabId,
            frameId,
            requestType,
        } = context;

        if (requestType !== RequestType.Document && requestType !== RequestType.SubDocument) {
            return;
        }

        const tabContext = tabsApi.getTabContext(tabId);

        if (!tabContext) {
            return;
        }

        const frame = tabContext.frames.get(frameId);

        if (!frame || !frame.cosmeticResult) {
            return;
        }

        /**
         * Actual tab url may not be committed by navigation event during response processing.
         * If {@link tabContext.info.url} and {@link url} are not the same, this means
         * that tab navigation steel is being processed and js injection may be causing the error.
         * In this case, js will be injected in the {@link WebNavigation.onCommitted} event.
         */
        if (requestType === RequestType.Document
            /**
             * Check if url exists because it might be empty for new tabs.
             * In this case we may inject on response started
             * (https://github.com/AdguardTeam/AdguardBrowserExtension/issues/2571).
             */
            && tabContext.info.url && tabContext.info.url !== frame.url) {
            return;
        }

        CosmeticApi.applyFrameJsRules(frameId, tabId);
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
    }: RequestData<WebRequest.OnCompletedDetailsType>): WebRequestEventResponse {
        if (!context) {
            return;
        }

        const {
            requestId,
            requestType,
            tabId,
            frameId,
            requestUrl,
            timestamp,
            contentType,
            cosmeticResult,
        } = context;

        /**
         * If the request is a subdocument request in Firefox, try injecting frame cosmetic result into frame,
         * because {@link WebRequestApi.onCommitted} can be not triggered.
         */
        if (isFirefox || requestType === RequestType.SubDocument) {
            WebRequestApi.injectCosmetic({
                frameId,
                tabId,
                timestamp,
                url: requestUrl,
            });
        }

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
        requestContextStorage.delete(details.requestId);
    }

    /**
     * Injects cosmetic rules to specified frame based on data from frame and response context.
     *
     * If cosmetic result does not exist or it has been already applied, ignore injection.
     *
     * @param params Data required for rule injection.
     */
    private static injectCosmetic(params: InjectCosmeticParams): void {
        const {
            frameId,
            tabId,
            url,
        } = params;

        const tabContext = tabsApi.getTabContext(tabId);

        if (!tabContext) {
            return;
        }

        let frame = tabContext.frames.get(frameId);

        /**
         * Subdocument frame context may not be created durning worker request processing.
         * We create new one in this case.
         */
        if (!frame) {
            frame = new Frame(url);
            tabContext.frames.set(frameId, frame);
        }

        /**
         * Cosmetic result may not be committed to frame context during worker request processing.
         * We use engine request as a fallback for this case.
         */
        if (!frame.cosmeticResult && isHttpOrWsRequest(url)) {
            frame.cosmeticResult = engineApi.matchCosmetic({
                requestUrl: url,
                frameUrl: url,
                requestType: frameId === MAIN_FRAME_ID ? RequestType.Document : RequestType.SubDocument,
                frameRule: tabContext.mainFrameRule,
            });
        }

        CosmeticApi.applyFrameCssRules(frameId, tabId);
        CosmeticApi.applyFrameJsRules(frameId, tabId);
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
     * On committed web navigation event handler.
     *
     * Injects necessary CSS and scripts into the web page.
     *
     * @param details Event details.
     */
    private static onCommitted(details: WebNavigation.OnCommittedDetailsType): void {
        const {
            frameId,
            tabId,
            timeStamp,
            url,
        } = details;

        /**
         * There is Opera bug that prevents firing WebRequest events for document and subdocument requests.
         * We now handle this by checking if matching result exists for main frame and if not - we create it.
         *
         * TODO remove this when Opera bug is fixed.
         */
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

        WebRequestApi.injectCosmetic({
            frameId,
            tabId,
            timestamp: timeStamp,
            url,
        });
    }

    /**
     * On DOM content loaded web navigation event handler.
     *
     * This method injects css and js code in iframes without remote source.
     * Usual webRequest callbacks don't fire for iframes without remote source.
     * Also urls in these iframes may be "about:blank", "about:srcdoc", etc.
     * Due to this reason we prepare injections for them as for mainframe
     * and inject them only when onDOMContentLoaded fires.
     *
     * @see https://github.com/AdguardTeam/AdguardBrowserExtension/issues/1046
     * @param details Event details.
     */
    private static onDomContentLoaded(details: WebNavigation.OnDOMContentLoadedDetailsType): void {
        const {
            tabId,
            frameId,
            url,
        } = details;

        const tabContext = tabsApi.getTabContext(tabId);

        const mainFrameUrl = tabContext?.info.url;

        if (!mainFrameUrl || !isLocalFrame(url, frameId, mainFrameUrl)) {
            return;
        }

        const cosmeticResult = engineApi.matchCosmetic({
            requestUrl: mainFrameUrl,
            frameUrl: mainFrameUrl,
            requestType: RequestType.Document,
            frameRule: tabContext.mainFrameRule,
        });

        CosmeticApi
            .applyCssRules({
                tabId,
                frameId,
                cosmeticResult,
            })
            .catch(logger.debug);

        CosmeticApi
            .applyJsRules({
                tabId,
                frameId,
                cosmeticResult,
                url,
            })
            .catch(logger.debug);
    }

    /**
     * Intercepts csp_report requests.
     * Check the URL of the report.
     * For chromium and firefox:
     * If it's sent to a third party, block it right away.
     * For firefox only:
     * If it contains moz://extension with our extension ID, block it as well.
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
         * TODO add the ability to prolong request and tab/frame contexts lives if it was not yet consumed
         * at webRequest or webNavigation events, i.e
         *   - keep requestContext, if webRequest.onCommitted has not been fired,
         *   - keep tab context if webNavigation.omCompleted has not been fired,
         * etc.
         */
        setTimeout(() => tabContext.frames.delete(frameId), FRAME_DELETION_TIMEOUT);
    }
}
