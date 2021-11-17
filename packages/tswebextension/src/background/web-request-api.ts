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
    preprocessRequestDetails,
    hideRequestInitiatorElement,
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
        browser.webRequest.onBeforeRequest.removeListener(this.onBeforeRequest);
        browser.webRequest.onBeforeRequest.removeListener(this.handleCspReportRequests);
        browser.webRequest.onBeforeSendHeaders.removeListener(this.onBeforeSendHeaders);
        browser.webRequest.onHeadersReceived.removeListener(this.onHeadersReceived);
        browser.webRequest.onErrorOccurred.removeListener(this.onErrorOccurred);
        browser.webRequest.onResponseStarted.removeListener(this.onResponseStarted);
        browser.webRequest.onCompleted.removeListener(this.onCompleted);
        browser.webNavigation.onCommitted.removeListener(this.onCommitted);
    }

    private onBeforeRequest(details: WebRequest.OnBeforeRequestDetailsType): WebRequestEventResponse {
        const requestDetails = preprocessRequestDetails(details);

        const {
            url,
            requestId,
            referrerUrl,
            requestType,
            tabId,
            frameId,
            thirdParty,
            requestFrameId,
        } = requestDetails;


        if (isOwnUrl(referrerUrl)
            || !isHttpOrWsRequest(url)) {
            return;
        }

        if (this.isFrameRequest(requestType)) {
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

        requestContextStorage.record(requestId, {
            requestUrl: url,
            referrerUrl,
            requestType,
            tabId,
            frameId,
            timestamp: Date.now(),
            matchingResult: result,
        });

        if (!result) {
            return;
        }

        const basicResult = result.getBasicResult();

        if (basicResult && !basicResult.isAllowlist()) {
            if (basicResult.isOptionEnabled(NetworkRuleOption.Redirect)) {
                const redirectUrl = redirectsApi.createRedirectUrl(basicResult.getAdvancedModifierValue());
                if (redirectUrl) {
                    return { redirectUrl };
                }
            }

            hideRequestInitiatorElement(tabId, requestFrameId, url, requestType, thirdParty);

            return { cancel: true };
        }

        return;
    }

    private onBeforeSendHeaders(details: WebRequest.OnBeforeSendHeadersDetailsType): WebRequestEventResponse {
        // TODO: implement
        return;
    }

    private onHeadersReceived(details: WebRequest.OnHeadersReceivedDetailsType): WebRequestEventResponse {
        const { requestId } = details;

        const request = requestContextStorage.get(requestId);

        if (!request?.matchingResult){
            return;
        }

        const {
            matchingResult,
            requestType,
            referrerUrl,
            tabId,
            frameId,
        } = request;

        if (this.isFrameRequest(requestType)){
            const cosmeticOption = matchingResult.getCosmeticOption();
            this.recordFrameInjection(referrerUrl, tabId, frameId, cosmeticOption);
        }
    }

    private onResponseStarted(details: WebRequest.OnResponseStartedDetailsType): WebRequestEventResponse {
        const { requestId } = details;
        const request = requestContextStorage.get(requestId);

        if (request?.requestType === RequestType.Document){
            this.injectJsScript(request.tabId, request.frameId);
        }
    }

    private onCompleted(details: WebRequest.OnCompletedDetailsType): WebRequestEventResponse {
        requestContextStorage.delete(details.requestId);
    }

    private onErrorOccurred(details: WebRequest.OnErrorOccurredDetailsType): WebRequestEventResponse {
        const { requestId, tabId, frameId } = details;

        const frame = tabsApi.getTabFrame(tabId, frameId);

        if (frame?.injection){
            delete frame.injection;
        }

        requestContextStorage.delete(requestId);
    }

    private handleCspReportRequests(details: WebRequest.OnBeforeRequestDetailsType): WebRequestEventResponse {
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

        browser.webRequest.onBeforeRequest.addListener(
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

        browser.webRequest.onBeforeRequest.addListener(
            this.handleCspReportRequests,
            filter,
            extraInfoSpec,
        );
    }

    private initBeforeSendHeadersEventListener(): void {
        const filter: WebRequest.RequestFilter = {
            urls: ['<all_urls>'],
        };

        browser.webRequest.onBeforeSendHeaders.addListener(
            this.onBeforeSendHeaders,
            filter,
        );
    }

    private initHeadersReceivedEventListener(): void {
        const filter: WebRequest.RequestFilter = {
            urls: ['<all_urls>'],
        };

        const extraInfoSpec: WebRequest.OnHeadersReceivedOptions[] = ['responseHeaders', 'blocking'];

        browser.webRequest.onHeadersReceived.addListener(
            this.onHeadersReceived,
            filter,
            extraInfoSpec,
        );
    }

    private initOnResponseStartedEventListener(): void {
        const filter: WebRequest.RequestFilter = {
            urls: ['<all_urls>'],
        };

        browser.webRequest.onResponseStarted.addListener(this.onResponseStarted, filter);
    }

    private initOnErrorOccurredEventListener(): void {
        const filter: WebRequest.RequestFilter = {
            urls: ['<all_urls>'],
        };

        browser.webRequest.onErrorOccurred.addListener(this.onErrorOccurred, filter);
    }

    private initOnCompletedEventListener(): void {
        const filter: WebRequest.RequestFilter = {
            urls: ['<all_urls>'],
        };

        const extraInfoSpec: WebRequest.OnCompletedOptions[] = ['responseHeaders'];

        browser.webRequest.onCompleted.addListener(
            this.onCompleted, 
            filter,
            extraInfoSpec,
        )
    }

    private initCommittedEventListener(): void {
        browser.webNavigation.onCommitted.addListener(this.onCommitted);
    }

    private isFrameRequest(requestType: RequestType): boolean {
        return requestType === RequestType.Document || requestType === RequestType.Subdocument;
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