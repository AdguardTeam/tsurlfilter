/* eslint-disable @typescript-eslint/no-unused-vars */
import browser, { WebRequest, WebNavigation } from 'webextension-polyfill';
import {
    CosmeticOption,
    RequestType,
    NetworkRuleOption,
} from '@adguard/tsurlfilter';

import { engineApi } from './engine-api';
import { tabsApi } from './tabs';
import { isOwnUrl, isHttpOrWsRequest, getDomain, isThirdPartyRequest } from './utils';
import { cosmeticApi } from './cosmetic-api';
import { redirectsService } from './services/redirects-service';
import {
    hideRequestInitiatorElement,
    RequestEvents,
    requestContextStorage,
    getRequestType,
} from './request';

export type WebRequestEventResponse = WebRequest.BlockingResponseOrPromise | void;

export interface WebRequestApiInterface {
    start: () => void;
    stop: () => void;
}


const MAX_URL_LENGTH = 1024 * 16;

export class WebRequestApi implements WebRequestApiInterface {
    constructor() {
        this.onBeforeRequest = this.onBeforeRequest.bind(this);
        this.onHeadersReceived = this.onHeadersReceived.bind(this);
        this.onResponseStarted = this.onResponseStarted.bind(this);
        this.onErrorOccurred = this.onErrorOccurred.bind(this);
        this.onCompleted = this.onCompleted.bind(this);

        this.onCommitted = this.onCommitted.bind(this);
    }

    public start(): void {
        // browser.webRequest Events
        RequestEvents.onBeforeRequest.addListener(this.onBeforeRequest);
        RequestEvents.onHeadersReceived.addListener(this.onHeadersReceived);
        RequestEvents.onResponseStarted.addListener(this.onResponseStarted);
        RequestEvents.onErrorOccurred.addListener(this.onErrorOccurred);
        RequestEvents.onCompleted.addListener(this.onCompleted);

        // browser.webNavigation Events
        browser.webNavigation.onCommitted.addListener(this.onCommitted);
    }

    public stop(): void {
        RequestEvents.onBeforeRequest.removeListener(this.onBeforeRequest);
        RequestEvents.onHeadersReceived.removeListener(this.onHeadersReceived);
        RequestEvents.onResponseStarted.removeListener(this.onResponseStarted);
        RequestEvents.onErrorOccurred.removeListener(this.onErrorOccurred);
        RequestEvents.onCompleted.removeListener(this.onCompleted);

        browser.webNavigation.onCommitted.removeListener(this.onCommitted);
    }

    private onBeforeRequest({ details }: RequestEvents.RequestData<
    WebRequest.OnBeforeRequestDetailsType
    >): WebRequestEventResponse {
        const {
            requestId,
            type,
            frameId,
            tabId,
            parentFrameId,
            originUrl,
            initiator,
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

        requestContextStorage.update(requestId, {
            requestUrl: url,
            referrerUrl,
            requestType,
            tabId,
            frameId,
            requestFrameId,
            thirdParty,
            contentType,
        });
        
        if (isOwnUrl(referrerUrl)
            || !isHttpOrWsRequest(url)) {
            return;
        }
        
        if (requestType === RequestType.Document || requestType === RequestType.Subdocument) {
            tabsApi.recordRequestFrame(
                tabId,
                frameId,
                referrerUrl,
                requestType,
            );
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

        if (basicResult && !basicResult.isAllowlist()) {
            if (basicResult.isOptionEnabled(NetworkRuleOption.Redirect)) {
                const redirectUrl = redirectsService.createRedirectUrl(basicResult.getAdvancedModifierValue());
                if (redirectUrl) {
                    return { redirectUrl };
                }
            }

            hideRequestInitiatorElement(tabId, requestFrameId, url, requestType, thirdParty);

            return { cancel: true };
        }

        return;
    }

    private onHeadersReceived({ context }: RequestEvents.RequestData<
    WebRequest.OnHeadersReceivedDetailsType
    >): WebRequestEventResponse {
        if (!context?.matchingResult){
            return;
        }

        const {
            matchingResult,
            requestType,
            referrerUrl,
            tabId,
            frameId,
        } = context;

        if (referrerUrl && (requestType === RequestType.Document || requestType === RequestType.Subdocument)){
            const cosmeticOption = matchingResult.getCosmeticOption();
            this.recordFrameInjection(referrerUrl, tabId, frameId, cosmeticOption);
        }
    }

    private onResponseStarted({ context }: RequestEvents.RequestData<
    WebRequest.OnResponseStartedDetailsType
    >): WebRequestEventResponse {
        if (!context?.matchingResult){
            return;
        }

        const {
            requestType,
            tabId,
            frameId,
        } = context;

        if (requestType === RequestType.Document){
            this.injectJsScript(tabId, frameId);
        }
    }

    private onCompleted({ details }: RequestEvents.RequestData<
    WebRequest.OnCompletedDetailsType
    >): WebRequestEventResponse {
        requestContextStorage.delete(details.requestId);
    }

    private onErrorOccurred({ details }: RequestEvents.RequestData<
    WebRequest.OnErrorOccurredDetailsType
    >): WebRequestEventResponse {
        const { requestId, tabId, frameId } = details;

        const frame = tabsApi.getTabFrame(tabId, frameId);

        if (frame?.injection){
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

        if (frame){
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

    private injectCosmetic(tabId: number, frameId: number): void{

        const frame = tabsApi.getTabFrame(tabId, frameId);

        if (frame?.injection){
            const { cssText, jsScriptText } = frame.injection;
    
            if (cssText){
                cosmeticApi.injectCss(cssText, tabId, frameId);
            }
            
            if (jsScriptText){
                cosmeticApi.injectScript(jsScriptText, tabId, frameId);
            }
    
            delete frame.injection;
        }
    }
}

export const webRequestApi = new WebRequestApi();
