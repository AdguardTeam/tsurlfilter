/* eslint-disable @typescript-eslint/no-unused-vars */
import browser, { WebRequest, WebNavigation } from 'webextension-polyfill';
import {
    CosmeticOption,
    RequestType,
    NetworkRuleOption,
} from '@adguard/tsurlfilter';

import { engineApi } from './engine-api';
import { tabsApi } from './tabs';
import { isOwnUrl, isHttpOrWsRequest, getDomain } from './utils';
import { cosmeticApi } from './cosmetic-api';
import { redirectsApi } from './redirects-api';
import {
    hideRequestInitiatorElement,
    onBeforeRequest,
    onBeforeSendHeaders,
    RequestData,
    onHeadersReceived,
    onErrorOccurred,
    onResponseStarted,
    onCompleted,
    requestContextStorage, 
} from './request';

export type WebRequestEventResponse = WebRequest.BlockingResponseOrPromise | void;

export interface WebRequestApiInterface {
    start: () => void;
    stop: () => void;
}

export class WebRequestApi implements WebRequestApiInterface {

    constructor() {
        this.onBeforeRequest = this.onBeforeRequest.bind(this);
        this.onBeforeSendHeaders = this.onBeforeSendHeaders.bind(this);
        this.onHeadersReceived = this.onHeadersReceived.bind(this);
        this.handleCspReportRequests = this.handleCspReportRequests.bind(this);
        this.onResponseStarted = this.onResponseStarted.bind(this);
        this.onErrorOccurred = this.onErrorOccurred.bind(this);
        this.onCompleted = this.onCompleted.bind(this);

        this.onCommitted = this.onCommitted.bind(this);
    }

    public start(): void {
        // browser.webRequest Events
        this.initBeforeRequestEventListener();
        this.initCspReportRequestsEventListener();

        this.initBeforeSendHeadersEventListener();
        this.initHeadersReceivedEventListener();
        this.initOnResponseStartedEventListener();
        this.initOnErrorOccurredEventListener();
        this.initOnCompletedEventListener();

        // browser.webNavigation Events
        this.initCommittedEventListener();
    }

    public stop(): void {
        onBeforeRequest.removeListener(this.onBeforeRequest);
        onBeforeRequest.removeListener(this.handleCspReportRequests);
        onBeforeSendHeaders.removeListener(this.onBeforeSendHeaders);
        onHeadersReceived.removeListener(this.onHeadersReceived);
        onErrorOccurred.removeListener(this.onErrorOccurred);
        onResponseStarted.removeListener(this.onResponseStarted);
        onCompleted.removeListener(this.onCompleted);
        browser.webNavigation.onCommitted.removeListener(this.onCommitted);
    }

    private onBeforeRequest({ context }: RequestData<WebRequest.OnBeforeRequestDetailsType>): WebRequestEventResponse {
        if (!context?.matchingResult) {
            return;
        }

        const basicResult = context.matchingResult.getBasicResult();

        if (basicResult && !basicResult.isAllowlist()) {
            if (basicResult.isOptionEnabled(NetworkRuleOption.Redirect)) {
                const redirectUrl = redirectsApi.createRedirectUrl(basicResult.getAdvancedModifierValue());
                if (redirectUrl) {
                    return { redirectUrl };
                }
            }

            const {
                tabId,
                requestFrameId,
                requestUrl,
                requestType,
                thirdParty,
            } = context;

            hideRequestInitiatorElement(tabId, requestFrameId, requestUrl, requestType, thirdParty);

            return { cancel: true };
        }

        return;
    }

    private onBeforeSendHeaders(data: RequestData<WebRequest.OnBeforeSendHeadersDetailsType>): WebRequestEventResponse {
        // TODO: implement
        return;
    }

    private onHeadersReceived({ context }: RequestData<WebRequest.OnHeadersReceivedDetailsType>): WebRequestEventResponse {
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

        if (requestType === RequestType.Document || requestType === RequestType.Subdocument){
            const cosmeticOption = matchingResult.getCosmeticOption();
            this.recordFrameInjection(referrerUrl, tabId, frameId, cosmeticOption);
        }
    }

    private onResponseStarted({ context }: RequestData<WebRequest.OnResponseStartedDetailsType>): WebRequestEventResponse {
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

    private onCompleted({ details }: RequestData<WebRequest.OnCompletedDetailsType>): WebRequestEventResponse {
        requestContextStorage.delete(details.requestId);
    }

    private onErrorOccurred({ details }: RequestData<WebRequest.OnErrorOccurredDetailsType>): WebRequestEventResponse {
        const { requestId, tabId, frameId } = details;

        const frame = tabsApi.getTabFrame(tabId, frameId);

        if (frame?.injection){
            delete frame.injection;
        }

        requestContextStorage.delete(requestId);
    }

    private handleCspReportRequests(data: RequestData<WebRequest.OnBeforeRequestDetailsType>): WebRequestEventResponse {
        // TODO: implement
        return;
    }


    private onCommitted(details: WebNavigation.OnCommittedDetailsType): void {
        this.injectCosmetic(details);
    }


    private initBeforeRequestEventListener(): void {
        const filter: WebRequest.RequestFilter = {
            urls: ['<all_urls>'],
        };

        const extraInfoSpec: WebRequest.OnBeforeRequestOptions[] = ['blocking'];

        onBeforeRequest.addListener(
            this.onBeforeRequest,
            filter,
            extraInfoSpec,
        );
    }

    /**
     * Handler for csp reports urls
     */
    private initCspReportRequestsEventListener(): void {
        const filter: WebRequest.RequestFilter = {
            urls: ['<all_urls>'],
            types: ['csp_report'],
        };

        const extraInfoSpec: WebRequest.OnBeforeRequestOptions[] = ['requestBody'];

        onBeforeRequest.addListener(
            this.handleCspReportRequests,
            filter,
            extraInfoSpec,
        );
    }

    private initBeforeSendHeadersEventListener(): void {
        const filter: WebRequest.RequestFilter = {
            urls: ['<all_urls>'],
        };

        onBeforeSendHeaders.addListener(
            this.onBeforeSendHeaders,
            filter,
        );
    }

    private initHeadersReceivedEventListener(): void {
        const filter: WebRequest.RequestFilter = {
            urls: ['<all_urls>'],
        };

        const extraInfoSpec: WebRequest.OnHeadersReceivedOptions[] = ['responseHeaders', 'blocking'];

        onHeadersReceived.addListener(
            this.onHeadersReceived,
            filter,
            extraInfoSpec,
        );
    }

    private initOnResponseStartedEventListener(): void {
        const filter: WebRequest.RequestFilter = {
            urls: ['<all_urls>'],
        };

        onResponseStarted.addListener(this.onResponseStarted, filter);
    }

    private initOnErrorOccurredEventListener(): void {
        const filter: WebRequest.RequestFilter = {
            urls: ['<all_urls>'],
        };

        onErrorOccurred.addListener(this.onErrorOccurred, filter);
    }

    private initOnCompletedEventListener(): void {
        const filter: WebRequest.RequestFilter = {
            urls: ['<all_urls>'],
        };

        const extraInfoSpec: WebRequest.OnCompletedOptions[] = ['responseHeaders'];

        onCompleted.addListener(
            this.onCompleted, 
            filter,
            extraInfoSpec,
        );
    }

    private initCommittedEventListener(): void {
        browser.webNavigation.onCommitted.addListener(this.onCommitted);
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

    private injectCosmetic(details: WebNavigation.OnCommittedDetailsType): void{
        const { url, tabId, frameId } = details;

        const frame = tabsApi.getTabFrame(tabId, frameId);

        const referrerUrl = frame?.url || getDomain(url) || url;

        if (isOwnUrl(referrerUrl)
            || !isHttpOrWsRequest(url)) {
            return;
        }

        if (frame?.injection){
            const { 
                cssText,
                extCssText,
                jsScriptText,
            } = frame.injection;
    
            if (cssText){
                cosmeticApi.injectCss(cssText, tabId, frameId);
            }
    
            if (extCssText){
                cosmeticApi.injectExtCss(extCssText, tabId, frameId);
            }
            
            if (jsScriptText){
                cosmeticApi.injectScript(jsScriptText, tabId, frameId);
            }
    
            delete frame.injection;
        }
    }
}

export const webRequestApi = new WebRequestApi();