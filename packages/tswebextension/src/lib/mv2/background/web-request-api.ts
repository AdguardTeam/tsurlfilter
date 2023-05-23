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
 * At {@link RequestEvents.onHeadersReceived}, the response headers are handled in the same way.
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
 * If a rule is successfully injected into one of the events being processed,
 * a flag is set in the {@link TabContext} context to block re-injection.
 *
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
 *                                       │                             │
 *                                       │       onBeforeNavigate      │
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
 *                                       │                             │ │
 *                                     ┌─┤         onCompleted         │ │
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
 *                                       │                             │
 *                                       │       onErrorOccurred       │
 *                                       │                             │
 *                                       └─────────────────────────────┘.
 */
import browser, { WebRequest, WebNavigation } from 'webextension-polyfill';
import { RequestType } from '@adguard/tsurlfilter/es/request-type';

import { engineApi } from './engine-api';
import { tabsApi } from './tabs/tabs-api';
import { MAIN_FRAME_ID } from './tabs/frame';
import { findHeaderByName } from './utils/headers';
import { isHttpOrWsRequest, getDomain } from '../../common/utils/url';
import { logger } from '../../common/utils/logger';
import { ContentType } from '../../common/request-type';
import { defaultFilteringLog, FilteringEventType } from '../../common/filtering-log';

import {
    CosmeticApi,
    type ApplyJsRulesParams,
    type ApplyCssRulesParams,
} from './cosmetic-api';
import { headersService } from './services/headers-service';
import { paramsService } from './services/params-service';
import { cookieFiltering } from './services/cookie-filtering/cookie-filtering';
import { ContentFiltering } from './services/content-filtering/content-filtering';
import { CspService } from './services/csp-service';
import {
    hideRequestInitiatorElement,
    RequestEvents,
    RequestData,
    requestContextStorage,
    RequestBlockingApi,
} from './request';
import { stealthApi } from './stealth-api';
import { SanitizeApi } from './sanitize-api';
import { isFirefox } from './utils';

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
        RequestEvents.onBeforeSendHeaders.addListener(WebRequestApi.onBeforeSendHeaders);
        RequestEvents.onHeadersReceived.addListener(WebRequestApi.onHeadersReceived);
        RequestEvents.onResponseStarted.addListener(WebRequestApi.onResponseStarted);
        RequestEvents.onErrorOccurred.addListener(WebRequestApi.onErrorOccurred);
        RequestEvents.onCompleted.addListener(WebRequestApi.onCompleted);

        // browser.webNavigation Events
        browser.webNavigation.onCommitted.addListener(WebRequestApi.onCommitted);
        browser.webNavigation.onDOMContentLoaded.addListener(WebRequestApi.onDomContentLoaded);
    }

    /**
     * Removes web request event handlers.
     */
    public static stop(): void {
        RequestEvents.onBeforeRequest.removeListener(WebRequestApi.onBeforeRequest);
        RequestEvents.onBeforeSendHeaders.removeListener(WebRequestApi.onBeforeSendHeaders);
        RequestEvents.onHeadersReceived.removeListener(WebRequestApi.onHeadersReceived);
        RequestEvents.onResponseStarted.removeListener(WebRequestApi.onResponseStarted);
        RequestEvents.onErrorOccurred.removeListener(WebRequestApi.onErrorOccurred);
        RequestEvents.onCompleted.removeListener(WebRequestApi.onCompleted);

        browser.webNavigation.onCommitted.removeListener(WebRequestApi.onCommitted);
        browser.webNavigation.onDOMContentLoaded.removeListener(WebRequestApi.onDomContentLoaded);
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
            requestId,
            contentType,
            timestamp,
            thirdParty,
            method,
            requestFrameId,
        } = context;

        if (requestType === RequestType.Document || requestType === RequestType.SubDocument) {
            tabsApi.handleFrameRequest(context);

            if (requestType === RequestType.Document) {
                defaultFilteringLog.publishEvent({
                    type: FilteringEventType.TabReload,
                    data: {
                        tabId,
                    },
                });
            }
        }

        if (!isHttpOrWsRequest(requestUrl)) {
            return undefined;
        }

        defaultFilteringLog.publishEvent({
            type: FilteringEventType.SendRequest,
            data: {
                tabId,
                eventId: requestId,
                requestUrl,
                requestDomain: getDomain(requestUrl) as string,
                frameUrl: referrerUrl,
                frameDomain: getDomain(referrerUrl) as string,
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

        const response = RequestBlockingApi.getBlockingResponse(
            basicResult,
            requestId,
            requestUrl,
            requestType,
            tabId,
        );

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
            tabsApi.incrementTabBlockedRequestCount(tabId);
            hideRequestInitiatorElement(tabId, requestFrameId, requestUrl, requestType, thirdParty);
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

            if (headersService.onBeforeSendHeaders(context)) {
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
        defaultFilteringLog.publishEvent({
            type: FilteringEventType.ReceiveResponse,
            data: {
                tabId: details.tabId,
                eventId: details.requestId,
                statusCode: details.statusCode,
            },
        });

        if (!context?.matchingResult) {
            return undefined;
        }

        const {
            requestId,
            requestUrl,
            requestType,
            responseHeaders,
        } = context;

        const contentTypeHeader = findHeaderByName(responseHeaders!, 'content-type')?.value;

        if (contentTypeHeader) {
            requestContextStorage.update(requestId, { contentTypeHeader });
        }

        let responseHeadersModified = false;

        if (requestUrl && (requestType === RequestType.Document || requestType === RequestType.SubDocument)) {
            if (CspService.onHeadersReceived(context)) {
                responseHeadersModified = true;
            }
        }

        if (cookieFiltering.onHeadersReceived(context)) {
            responseHeadersModified = true;
        }

        if (headersService.onHeadersReceived(context)) {
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
            requestId,
            tabId,
            frameId,
            requestType,
            contentType,
            timestamp,
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
        if (requestType === RequestType.Document && frame.url !== tabContext.info.url) {
            return;
        }

        const {
            cosmeticResult,
            url,
            jsInjectionFsm,
        } = frame;

        const injectionParams: ApplyJsRulesParams = {
            requestId,
            url,
            tabId,
            frameId,
            cosmeticResult,
            timestamp,
            contentType,
        };

        CosmeticApi.applyFrameJsRules(injectionParams, jsInjectionFsm);
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
     * Checks if iframe has same source as main frame or if src is about:blank, javascript:, etc.
     * We don't include frames with 'src=data:' because Chrome and Firefox
     * do not allow data to be injected into frames with this type of src,
     * this bug is reported here https://bugs.chromium.org/p/chromium/issues/detail?id=55084.
     *
     * @param frameUrl Frame url.
     * @param frameId Unique id of frame in the tab.
     * @param mainFrameUrl Url of tab where iframe exists.
     * @returns True if frame without src, else returns false.
     */
    private static isLocalFrame(frameUrl: string, frameId: number, mainFrameUrl: string): boolean {
        return frameId !== MAIN_FRAME_ID
            && (frameUrl === mainFrameUrl
                || frameUrl === 'about:blank'
                || frameUrl === 'about:srcdoc'
                // eslint-disable-next-line no-script-url
                || frameUrl.indexOf('javascript:') > -1);
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
            timestamp,
            url,
        } = params;

        const frame = tabsApi.getTabFrame(tabId, frameId);

        if (!frame
            || !frame.cosmeticResult
            || !frame.requestId) {
            return;
        }

        const {
            cosmeticResult,
            requestId,
            cssInjectionFsm,
            jsInjectionFsm,
        } = frame;

        const cssInjectionParams: ApplyCssRulesParams = {
            tabId,
            frameId,
            cosmeticResult,
        };

        const jsInjectionParams: ApplyJsRulesParams = {
            requestId,
            url,
            tabId,
            frameId,
            cosmeticResult,
            timestamp,
            contentType: frameId === MAIN_FRAME_ID
                ? ContentType.Document
                : ContentType.Subdocument,
        };

        CosmeticApi.applyFrameCssRules(cssInjectionParams, cssInjectionFsm);
        CosmeticApi.applyFrameJsRules(jsInjectionParams, jsInjectionFsm);
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
            timeStamp,
        } = details;

        const mainFrame = tabsApi.getTabMainFrame(tabId);

        if (!mainFrame
            || !mainFrame.cosmeticResult
            || !mainFrame.requestId
            || !WebRequestApi.isLocalFrame(url, frameId, mainFrame.url)) {
            return;
        }

        const { cosmeticResult, requestId } = mainFrame;

        CosmeticApi
            .applyCssRules({
                tabId,
                frameId,
                cosmeticResult,
            })
            .catch(logger.debug);

        CosmeticApi
            .applyJsRules({
                requestId,
                url: mainFrame.url,
                tabId,
                frameId,
                cosmeticResult,
                timestamp: timeStamp,
                contentType: ContentType.Subdocument,
            })
            .catch(logger.debug);
    }
}
