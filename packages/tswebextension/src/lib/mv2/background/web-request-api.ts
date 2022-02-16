import browser, { WebRequest, WebNavigation } from 'webextension-polyfill';
import { CosmeticOption, RequestType } from '@adguard/tsurlfilter';

import { engineApi } from './engine-api';
import { tabsApi } from './tabs';
import {
    isOwnUrl,
    isHttpOrWsRequest,
    getDomain,
    isThirdPartyRequest,
    findHeaderByName,
} from './utils';
import { CosmeticApi } from './cosmetic-api';
import { headersService } from './services/headers-service';
import { paramsService } from './services/params-service';
import { cookieFiltering } from './services/cookie-filtering/cookie-filtering';
import { ContentFiltering } from './services/content-filtering/content-filtering';
import {
    hideRequestInitiatorElement,
    RequestEvents,
    RequestData,
    requestContextStorage,
    getRequestType,
    RequestBlockingApi,
} from './request';

export type WebRequestEventResponse = WebRequest.BlockingResponseOrPromise | void;

const MAX_URL_LENGTH = 1024 * 16;
const CSP_HEADER_NAME = 'Content-Security-Policy';

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

        let requestFrameId = type === 'main_frame'
            ? frameId
            : parentFrameId;

        // Relate request to main_frame
        if (requestFrameId === -1) {
            requestFrameId = 0;
        }

        const referrerUrl = originUrl
            || initiator
            || getDomain(url)
            || url;

        const thirdParty = isThirdPartyRequest(url, referrerUrl);

        if (requestType === RequestType.Document || requestType === RequestType.Subdocument) {
            tabsApi.recordRequestFrame(
                tabId,
                frameId,
                url,
                requestType,
            );
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

        if (isOwnUrl(referrerUrl)
            || !isHttpOrWsRequest(url)) {
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
            hideRequestInitiatorElement(tabId, requestFrameId, url, requestType, thirdParty);
        }

        ContentFiltering.onBeforeRequest(requestId);

        return response;
    }

    private static onBeforeSendHeaders(
        data: RequestData<WebRequest.OnBeforeSendHeadersDetailsType>,
    ): WebRequestEventResponse {
        if (!data.context?.matchingResult) {
            return;
        }

        cookieFiltering.onBeforeSendHeaders(data.details);

        let requestHeadersModified = false;
        if (headersService.onBeforeSendHeaders(data)) {
            requestHeadersModified = true;
        }

        if (requestHeadersModified) {
            return { requestHeaders: data.details.requestHeaders };
        }
    }

    private static onHeadersReceived(
        data: RequestData<WebRequest.OnHeadersReceivedDetailsType>,
    ): WebRequestEventResponse {
        const { context } = data;

        if (!context?.matchingResult) {
            return;
        }

        const {
            requestId,
            requestUrl,
            matchingResult,
            requestType,
            tabId,
            frameId,
        } = context;

        const contentTypeHeader = findHeaderByName(data.details.responseHeaders!, 'content-type')?.value;

        if (contentTypeHeader) {
            requestContextStorage.update(requestId, { contentTypeHeader });
        }

        let responseHeadersModified = false;

        if (requestUrl && (requestType === RequestType.Document || requestType === RequestType.Subdocument)) {
            const cosmeticOption = matchingResult.getCosmeticOption();
            WebRequestApi.recordFrameInjection(requestUrl, tabId, frameId, cosmeticOption);

            // TODO: replace to separate method
            const cspHeaders = [];

            const cspRules = matchingResult.getCspRules();

            for (let i = 0; i < cspRules.length; i += 1) {
                const rule = cspRules[i];
                // Don't forget: getCspRules returns all $csp rules, we must directly check that the rule is blocking.
                if (RequestBlockingApi.isRequestBlockedByRule(rule)) {
                    const cspHeaderValue = rule.getAdvancedModifierValue();

                    if (cspHeaderValue) {
                        cspHeaders.push({
                            name: CSP_HEADER_NAME,
                            value: cspHeaderValue,
                        });
                    }
                }
            }

            if (cspHeaders.length > 0) {
                // eslint-disable-next-line no-param-reassign
                data.details.responseHeaders = data.details.responseHeaders
                    ? data.details.responseHeaders.concat(cspHeaders)
                    : cspHeaders;

                responseHeadersModified = true;
            }
        }

        // TODO: it is not obvious that data.details can mutate here
        // Is better process context instead of details and return a new array in these methods?

        if (cookieFiltering.onHeadersReceived(data.details)) {
            responseHeadersModified = true;
        }

        if (headersService.onHeadersReceived(data)) {
            responseHeadersModified = true;
        }

        if (responseHeadersModified) {
            return { responseHeaders: data.details.responseHeaders };
        }
    }

    private static onResponseStarted({ context }: RequestData<
    WebRequest.OnResponseStartedDetailsType
    >): WebRequestEventResponse {
        if (!context?.matchingResult) {
            return;
        }

        const {
            requestType,
            tabId,
            frameId,
        } = context;

        if (requestType === RequestType.Document) {
            WebRequestApi.injectJsScript(tabId, frameId);
        }
    }

    private static onCompleted({ details }: RequestData<
    WebRequest.OnCompletedDetailsType
    >): WebRequestEventResponse {
        requestContextStorage.delete(details.requestId);
    }

    private static onErrorOccurred({ details }: RequestData<
    WebRequest.OnErrorOccurredDetailsType
    >): WebRequestEventResponse {
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

    private static recordFrameInjection(
        url: string,
        tabId: number,
        frameId: number,
        cosmeticOption: CosmeticOption,
    ): void {
        const cosmeticResult = engineApi.getCosmeticResult(url, cosmeticOption);

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
