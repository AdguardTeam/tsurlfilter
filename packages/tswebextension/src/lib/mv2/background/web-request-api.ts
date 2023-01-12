import browser, { WebRequest, WebNavigation } from 'webextension-polyfill';
import { RequestType } from '@adguard/tsurlfilter';

import { engineApi } from './engine-api';
import { tabsApi } from './tabs';
import { findHeaderByName } from './utils';

import {
    isHttpOrWsRequest,
    defaultFilteringLog,
    FilteringEventType,
    getDomain,
} from '../../common';

import { CosmeticApi } from './cosmetic-api';
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
    RequestContext,
} from './request';
import { stealthApi } from './stealth-api';
import { SanitizeApi } from './sanitize-api';

export type WebRequestEventResponse = WebRequest.BlockingResponseOrPromise | void;

/**
 * API for handling browser web request events.
 *
 * @class WebRequestApi
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
            tabsApi.recordFrameRequest(context);

            if (requestType === RequestType.Document) {
                defaultFilteringLog.publishEvent({
                    type: FilteringEventType.TAB_RELOAD,
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
            type: FilteringEventType.SEND_REQUEST,
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
            const cosmeticOption = result.getCosmeticOption();

            const cosmeticResult = engineApi.getCosmeticResult(requestUrl, cosmeticOption);

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
            tabsApi.updateTabBlockedRequestCount(tabId, 1);
            hideRequestInitiatorElement(tabId, requestFrameId, requestUrl, requestType, thirdParty);
        } else {
            ContentFiltering.onBeforeRequest(requestId);
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
            cookieFiltering.onBeforeSendHeaders(context);

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
            type: FilteringEventType.RECEIVE_RESPONSE,
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

        WebRequestApi.injectJsScript(context);
    }

    /**
     * This is handler for the last event from the request lifecycle.
     *
     * @param event On completed event.
     * @param event.details On completed event details.
     * @private
     */
    private static onCompleted({
        details,
    }: RequestData<WebRequest.OnCompletedDetailsType>): WebRequestEventResponse {
        requestContextStorage.delete(details.requestId);
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
     * On committed web navigation event handler. We use it because it is more reliable than webRequest events.
     *
     * @param details Event details.
     */
    private static onCommitted(details: WebNavigation.OnCommittedDetailsType): void {
        const { frameId, tabId } = details;
        WebRequestApi.injectCosmetic(tabId, frameId);
    }

    /**
     * Injects css in the page.
     *
     * @param context Request context.
     */
    private static injectCss(context: RequestContext): void {
        if (!context?.cosmeticResult) {
            return;
        }

        const {
            tabId,
            frameId,
            cosmeticResult,
        } = context;

        const cssText = CosmeticApi.getCssText(cosmeticResult, true);

        if (cssText) {
            CosmeticApi.injectCss(cssText, tabId, frameId);
        }
    }

    /**
     * Injects js script in the page.
     *
     * @param context Request context.
     */
    private static injectJsScript(context: RequestContext): void {
        if (!context?.cosmeticResult) {
            return;
        }

        const {
            tabId,
            requestId,
            requestUrl,
            frameId,
            requestType,
            contentType,
            timestamp,
            cosmeticResult,
        } = context;

        if (requestType === RequestType.Document || requestType === RequestType.SubDocument) {
            const scriptRules = cosmeticResult.getScriptRules();

            const scriptText = CosmeticApi.getScriptText(scriptRules);

            if (scriptText) {
                /**
                 * @see {@link LocalScriptRulesService} for details about script source
                 */
                CosmeticApi.injectScript(scriptText, tabId, frameId);

                for (const scriptRule of scriptRules) {
                    if (!scriptRule.isGeneric()) {
                        defaultFilteringLog.publishEvent({
                            type: FilteringEventType.JS_INJECT,
                            data: {
                                script: true,
                                tabId,
                                eventId: requestId,
                                requestUrl,
                                frameUrl: requestUrl,
                                frameDomain: getDomain(requestUrl) as string,
                                requestType: contentType,
                                timestamp,
                                rule: scriptRule,
                            },
                        });
                    }
                }
            }

            const setDomSignalScript = stealthApi.getSetDomSignalScript();
            CosmeticApi.injectScript(setDomSignalScript, tabId, frameId);
        }
    }

    /**
     * Injects cosmetic rules in the page.
     *
     * @param tabId Tab id.
     * @param frameId Frame id.
     */
    private static injectCosmetic(tabId: number, frameId: number): void {
        const frame = tabsApi.getTabFrame(tabId, frameId);

        if (!frame?.requestContext) {
            return;
        }

        const { requestContext } = frame;

        WebRequestApi.injectCss(requestContext);
        WebRequestApi.injectJsScript(requestContext);
    }
}
