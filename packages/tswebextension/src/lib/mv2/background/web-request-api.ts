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
 * @class WebRequestApi
 */
export class WebRequestApi {
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

    public static stop(): void {
        RequestEvents.onBeforeRequest.removeListener(WebRequestApi.onBeforeRequest);
        RequestEvents.onBeforeSendHeaders.removeListener(WebRequestApi.onBeforeSendHeaders);
        RequestEvents.onHeadersReceived.removeListener(WebRequestApi.onHeadersReceived);
        RequestEvents.onResponseStarted.removeListener(WebRequestApi.onResponseStarted);
        RequestEvents.onErrorOccurred.removeListener(WebRequestApi.onErrorOccurred);
        RequestEvents.onCompleted.removeListener(WebRequestApi.onCompleted);

        browser.webNavigation.onCommitted.removeListener(WebRequestApi.onCommitted);
    }

    private static onBeforeRequest(
        { context }: RequestData<WebRequest.OnBeforeRequestDetailsType>,
    ): WebRequestEventResponse {
        if (!context) {
            return;
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
            return;
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
            return;
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

    private static onBeforeSendHeaders({
        context,
    }: RequestData<WebRequest.OnBeforeSendHeadersDetailsType>): WebRequestEventResponse {
        if (!context) {
            return;
        }

        const sanitizedRequest = SanitizeApi.onBeforeSendHeaders(context);
        if (sanitizedRequest) {
            return sanitizedRequest;
        }

        stealthApi.onBeforeSendHeaders(context);

        if (!context?.matchingResult) {
            return;
        }

        cookieFiltering.onBeforeSendHeaders(context);

        // TODO: Is this variable needed?
        let requestHeadersModified = false;
        if (headersService.onBeforeSendHeaders(context)) {
            requestHeadersModified = true;
        }

        if (requestHeadersModified) {
            return { requestHeaders: context.requestHeaders };
        }
    }

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
            return;
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
    }

    private static onResponseStarted({
        context,
    }: RequestData<WebRequest.OnResponseStartedDetailsType>): WebRequestEventResponse {
        if (!context) {
            return;
        }

        WebRequestApi.injectJsScript(context);
    }

    private static onCompleted({
        details,
    }: RequestData<WebRequest.OnCompletedDetailsType>): WebRequestEventResponse {
        requestContextStorage.delete(details.requestId);
    }

    private static onErrorOccurred({
        details,
    }: RequestData<WebRequest.OnErrorOccurredDetailsType>): WebRequestEventResponse {
        requestContextStorage.delete(details.requestId);
    }

    private static onCommitted(details: WebNavigation.OnCommittedDetailsType): void {
        const { frameId, tabId } = details;
        WebRequestApi.injectCosmetic(tabId, frameId);
    }

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
        }
    }

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
