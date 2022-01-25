import browser, { WebRequest, WebNavigation } from 'webextension-polyfill';
import { CosmeticOption, RequestType } from '@adguard/tsurlfilter';

import { engineApi } from './engine-api';
import { tabsApi } from './tabs';
import { isOwnUrl, isHttpOrWsRequest, getDomain, isThirdPartyRequest } from './utils';
import { cosmeticApi } from './cosmetic-api';
import { headersService } from './services/headers-service';
import { paramsService } from './services/params-service';
import { cookieFiltering } from './services/cookie-filtering/cookie-filtering';
import { contentFilteringService } from './services/content-filtering/content-filtering';
import {
    hideRequestInitiatorElement,
    RequestEvents,
    RequestData,
    requestContextStorage,
    getRequestType,
    requestBlockingApi,
} from './request';
import { findHeaderByName } from './utils/headers';

export type WebRequestEventResponse = WebRequest.BlockingResponseOrPromise | void;

export interface WebRequestApiInterface {
    start: () => void;
    stop: () => void;
}


const MAX_URL_LENGTH = 1024 * 16;
const CSP_HEADER_NAME = 'Content-Security-Policy';

export class WebRequestApi implements WebRequestApiInterface {
    constructor() {
        this.onBeforeRequest = this.onBeforeRequest.bind(this);
        this.onBeforeSendHeaders = this.onBeforeSendHeaders.bind(this);
        this.onHeadersReceived = this.onHeadersReceived.bind(this);
        this.onResponseStarted = this.onResponseStarted.bind(this);
        this.onErrorOccurred = this.onErrorOccurred.bind(this);
        this.onCompleted = this.onCompleted.bind(this);

        this.onCommitted = this.onCommitted.bind(this);
    }

    public start(): void {
        // browser.webRequest Events
        RequestEvents.onBeforeRequest.addListener(this.onBeforeRequest);
        RequestEvents.onBeforeSendHeaders.addListener(this.onBeforeSendHeaders);
        RequestEvents.onHeadersReceived.addListener(this.onHeadersReceived);
        RequestEvents.onResponseStarted.addListener(this.onResponseStarted);
        RequestEvents.onErrorOccurred.addListener(this.onErrorOccurred);
        RequestEvents.onCompleted.addListener(this.onCompleted);

        // browser.webNavigation Events
        browser.webNavigation.onCommitted.addListener(this.onCommitted);
    }

    public stop(): void {
        RequestEvents.onBeforeRequest.removeListener(this.onBeforeRequest);
        RequestEvents.onBeforeSendHeaders.removeListener(this.onBeforeSendHeaders);
        RequestEvents.onHeadersReceived.removeListener(this.onHeadersReceived);
        RequestEvents.onResponseStarted.removeListener(this.onResponseStarted);
        RequestEvents.onErrorOccurred.removeListener(this.onErrorOccurred);
        RequestEvents.onCompleted.removeListener(this.onCompleted);

        browser.webNavigation.onCommitted.removeListener(this.onCommitted);
    }

    private onBeforeRequest(
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

        const response = requestBlockingApi.getBlockedResponseByRule(basicResult, requestType);

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

        if (browser.webRequest.filterResponseData) {
            const cosmeticResult = engineApi.getCosmeticResult(
                referrerUrl!, CosmeticOption.CosmeticOptionHtml,
            );

            const htmlRules = cosmeticResult.Html.getRules();

            if (htmlRules.length > 0) {
                requestContextStorage.update(requestId, { htmlRules: cosmeticResult.Html.getRules() });
            }

            // Bypass images
            // https://github.com/AdguardTeam/AdguardBrowserExtension/issues/1906
            if (requestType !== RequestType.Image) {
                contentFilteringService.onBeforeRequest(
                    browser.webRequest.filterResponseData(requestId),
                    details,
                );
            }
        }

        return response;
    }

    private onBeforeSendHeaders(
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

    private onHeadersReceived(
        data: RequestData<WebRequest.OnHeadersReceivedDetailsType>,
    ): WebRequestEventResponse {
        const { context, details } = data;

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

        let { responseHeaders } = context;


        const contentTypeHeader = findHeaderByName(responseHeaders!, 'content-type')?.value;

        if (contentTypeHeader) {
            requestContextStorage.update(requestId, { contentTypeHeader });
        }

        let responseHeadersModified = false;

        if (requestUrl && (requestType === RequestType.Document || requestType === RequestType.Subdocument)) {
            const cosmeticOption = matchingResult.getCosmeticOption();
            this.recordFrameInjection(requestUrl, tabId, frameId, cosmeticOption);

            // TODO: replace to separate method
            const cspHeaders = [];

            const cspRules = matchingResult.getCspRules();

            for (let i = 0; i < cspRules.length; i += 1) {
                const rule = cspRules[i];
                // Don't forget: getCspRules returns all $csp rules, we must directly check that the rule is blocking.
                if (requestBlockingApi.isRequestBlockedByRule(rule)) {

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
                responseHeaders = responseHeaders
                    ? responseHeaders.concat(cspHeaders)
                    : cspHeaders;

                responseHeadersModified = true;
            }
        }

        cookieFiltering.onHeadersReceived(details);

        if (headersService.onHeadersReceived(data)) {
            responseHeadersModified = true;
        }

        if (responseHeadersModified) {
            return { responseHeaders };
        }

        cookieFiltering.onHeadersReceived(details);

        if (headersService.onHeadersReceived(data)) {
            responseHeadersModified = true;
        }

        if (responseHeadersModified) {
            return { responseHeaders: details.responseHeaders };
        }
    }

    private onResponseStarted({ context }: RequestData<
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
            this.injectJsScript(tabId, frameId);
        }
    }

    private onCompleted({ details }: RequestData<
    WebRequest.OnCompletedDetailsType
    >): WebRequestEventResponse {
        requestContextStorage.delete(details.requestId);
    }

    private onErrorOccurred({ details }: RequestData<
    WebRequest.OnErrorOccurredDetailsType
    >): WebRequestEventResponse {
        const { requestId, tabId, frameId } = details;

        const frame = tabsApi.getTabFrame(tabId, frameId);

        if (frame?.injection) {
            delete frame.injection;
        }

        requestContextStorage.delete(requestId);
    }


    private onCommitted(details: WebNavigation.OnCommittedDetailsType): void {
        const { frameId, tabId } = details;
        this.injectCosmetic(tabId, frameId);
    }

    private recordFrameInjection(
        url: string,
        tabId: number,
        frameId: number,
        cosmeticOption: CosmeticOption,
    ): void {
        const cosmeticResult = engineApi.getCosmeticResult(url, cosmeticOption);

        const cssText = cosmeticApi.getCssText(cosmeticResult);
        const extCssText = cosmeticApi.getExtCssText(cosmeticResult);
        const jsScriptText = cosmeticApi.getScriptText(cosmeticResult);

        const frame = tabsApi.getTabFrame(tabId, frameId);

        if (frame) {
            frame.injection = {
                cssText,
                extCssText,
                jsScriptText,
            };
        }
    }

    private injectJsScript(tabId: number, frameId: number) {
        const frame = tabsApi.getTabFrame(tabId, frameId);

        if (frame?.injection?.jsScriptText) {
            cosmeticApi.injectScript(frame.injection.jsScriptText, tabId, frameId);
        }
    }

    private injectCosmetic(tabId: number, frameId: number): void {

        const frame = tabsApi.getTabFrame(tabId, frameId);

        if (frame?.injection) {
            const { cssText, jsScriptText } = frame.injection;

            if (cssText) {
                cosmeticApi.injectCss(cssText, tabId, frameId);
            }

            if (jsScriptText) {
                cosmeticApi.injectScript(jsScriptText, tabId, frameId);
            }

            delete frame.injection;
        }
    }
}

export const webRequestApi = new WebRequestApi();
