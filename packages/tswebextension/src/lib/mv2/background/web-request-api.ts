import browser, { WebRequest, WebNavigation } from 'webextension-polyfill';
import { RequestType } from '@adguard/tsurlfilter';

import { engineApi } from './engine-api';
import { tabsApi } from './tabs';
import {
    isOwnUrl,
    getDomain,
    isThirdPartyRequest,
    findHeaderByName,
} from './utils';

import {
    isHttpOrWsRequest,
    defaultFilteringLog,
    FilteringEventType,
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
    getRequestType,
    RequestBlockingApi,
    RequestContext,
} from './request';

export type WebRequestEventResponse = WebRequest.BlockingResponseOrPromise | void;

const MAX_URL_LENGTH = 1024 * 16;

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
        data: RequestData<WebRequest.OnBeforeRequestDetailsType>,
    ): WebRequestEventResponse {
        const { details } = data;

        const {
            requestId,
            type,
            frameId,
            tabId,
            parentFrameId,
            originUrl,
            initiator,
            method,
        } = details;

        let { url } = details;

        /**
         * truncate too long urls
         * https://github.com/AdguardTeam/AdguardBrowserExtension/issues/1493
         */
        if (url.length > MAX_URL_LENGTH) {
            url = url.slice(0, MAX_URL_LENGTH);
        }

        /**
         * FF sends http instead of ws protocol at the http-listeners layer
         * Although this is expected, as the Upgrade request is indeed an HTTP request,
         * we use a chromium based approach in this case.
         */
        if (type === 'websocket' && url.indexOf('http') === 0) {
            url = url.replace(/^http(s)?:/, 'ws$1:');
        }

        const { requestType, contentType } = getRequestType(type);

        let requestFrameId = type === 'main_frame' ? frameId : parentFrameId;

        // Relate request to main_frame
        if (requestFrameId === -1) {
            requestFrameId = 0;
        }

        const referrerUrl = originUrl || initiator || getDomain(url) || url;

        const thirdParty = isThirdPartyRequest(url, referrerUrl);

        if (requestType === RequestType.Document || requestType === RequestType.Subdocument) {
            tabsApi.recordRequestFrame(tabId, frameId, url, requestType);
        }

        requestContextStorage.update(requestId, {
            requestUrl: url,
            referrerUrl,
            requestType,
            requestFrameId,
            thirdParty,
            contentType,
            method,
        });

        if (isOwnUrl(referrerUrl) || !isHttpOrWsRequest(url)) {
            return;
        }

        const result = engineApi.matchRequest({
            requestUrl: url,
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

        if (requestType === RequestType.Document || requestType === RequestType.Subdocument) {
            const cosmeticOption = result.getCosmeticOption();

            const cosmeticResult = engineApi.getCosmeticResult(url, cosmeticOption);

            requestContextStorage.update(requestId, {
                cosmeticResult,
            });
        }

        const basicResult = result.getBasicResult();

        const response = RequestBlockingApi.getBlockedResponseByRule(basicResult, requestType);

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
            defaultFilteringLog.publishEvent({
                type: FilteringEventType.BLOCK_REQUEST,
                data: {
                    tabId,
                    requestUrl: url,
                    referrerUrl,
                    requestType,
                    rule: basicResult!.getText(),
                    filterId: basicResult!.getFilterListId(),
                },
            });

            tabsApi.updateTabBlockedRequestCount(tabId, 1);

            hideRequestInitiatorElement(tabId, requestFrameId, url, requestType, thirdParty);
        } else {
            ContentFiltering.onBeforeRequest(requestId);
        }

        return response;
    }

    private static onBeforeSendHeaders({
        context,
    }: RequestData<WebRequest.OnBeforeSendHeadersDetailsType>): WebRequestEventResponse {
        if (!context?.matchingResult) {
            return;
        }

        cookieFiltering.onBeforeSendHeaders(context);

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
    }: RequestData<WebRequest.OnHeadersReceivedDetailsType>): WebRequestEventResponse {
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

        if (requestUrl && (requestType === RequestType.Document || requestType === RequestType.Subdocument)) {
            WebRequestApi.recordFrameInjection(context);

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
        if (!context?.matchingResult) {
            return;
        }

        const { requestType, tabId, frameId } = context;

        if (requestType === RequestType.Document) {
            WebRequestApi.injectJsScript(tabId, frameId);
        }
    }

    private static onCompleted({
        details,
    }: RequestData<WebRequest.OnCompletedDetailsType>): WebRequestEventResponse {
        requestContextStorage.delete(details.requestId);
    }

    private static onErrorOccurred({
        details,
    }: RequestData<WebRequest.OnErrorOccurredDetailsType>): WebRequestEventResponse {
        const { requestId, tabId, frameId } = details;

        const frame = tabsApi.getTabFrame(tabId, frameId);

        if (frame?.injection) {
            delete frame.injection;
        }

        requestContextStorage.delete(requestId);
    }

    private static onCommitted(details: WebNavigation.OnCommittedDetailsType): void {
        const { frameId, tabId } = details;
        WebRequestApi.injectCosmetic(tabId, frameId);
    }

    private static recordFrameInjection(context: RequestContext): void {
        const {
            cosmeticResult,
            tabId,
            frameId,
        } = context;

        if (!cosmeticResult) {
            return;
        }

        const cssText = CosmeticApi.getCssText(cosmeticResult);
        const extCssText = CosmeticApi.getExtCssText(cosmeticResult);
        const jsScriptText = CosmeticApi.getScriptText(cosmeticResult);

        const frame = tabsApi.getTabFrame(tabId, frameId);

        if (frame) {
            frame.injection = {
                cssText,
                extCssText,
                jsScriptText,
            };
        }
    }

    private static injectJsScript(tabId: number, frameId: number) {
        const frame = tabsApi.getTabFrame(tabId, frameId);

        if (frame?.injection?.jsScriptText) {
            CosmeticApi.injectScript(frame.injection.jsScriptText, tabId, frameId);
        }
    }

    private static injectCosmetic(tabId: number, frameId: number): void {
        const frame = tabsApi.getTabFrame(tabId, frameId);

        if (frame?.injection) {
            const { cssText, jsScriptText } = frame.injection;

            if (cssText) {
                CosmeticApi.injectCss(cssText, tabId, frameId);
            }

            if (jsScriptText) {
                CosmeticApi.injectScript(jsScriptText, tabId, frameId);
            }

            delete frame.injection;
        }
    }
}
