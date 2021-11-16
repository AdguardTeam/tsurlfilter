/* eslint-disable @typescript-eslint/no-unused-vars */
import browser, { WebRequest, WebNavigation } from 'webextension-polyfill';
import {
    CosmeticOption,
    RequestType,
    NetworkRuleOption
} from '@adguard/tsurlfilter';

import { engineApi } from './engine-api';
import { tabsApi } from './tabs';
import { isOwnUrl, isHttpOrWsRequest, getDomain } from './utils';
import { cosmeticApi } from './cosmetic-api';
import { redirectsApi } from './redirects-api';
import { preprocessRequestDetails, hideRequestInitiatorElement } from './request';

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
        this.onCommitted = this.onCommitted.bind(this);
    }

    public start(): void {
        this.initBeforeRequestEventListener();
        this.initCspReportRequestsEventListener();
        this.initBeforeSendHeadersEventListener();
        this.initHeadersReceivedEventListener();
        this.initOnResponseStarted();
        this.initOnErrorOccurred();
        this.initCommittedEventListener();
    }

    public stop(): void {
        browser.webRequest.onBeforeRequest.removeListener(this.onBeforeRequest);
        browser.webRequest.onBeforeRequest.removeListener(this.handleCspReportRequests);
        browser.webRequest.onBeforeSendHeaders.removeListener(this.onBeforeSendHeaders);
        browser.webRequest.onHeadersReceived.removeListener(this.onHeadersReceived);
        browser.webRequest.onErrorOccurred.removeListener(this.onErrorOccurred);
        browser.webRequest.onResponseStarted.removeListener(this.onResponseStarted);
        browser.webNavigation.onCommitted.removeListener(this.onCommitted);
    }

    private onBeforeRequest(details: WebRequest.OnBeforeRequestDetailsType): WebRequestEventResponse {
        const requestDetails = preprocessRequestDetails(details);

        const {
            url,
            referrerUrl,
            requestType,
            tabId,
            frameId,
            thirdParty,
            requestFrameId
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
        const requestDetails = preprocessRequestDetails(details);

        const {
            url,
            referrerUrl,
            requestType,
            tabId,
            frameId,
        } = requestDetails;

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

        if (this.isFrameRequest(requestType)){
            const cosmeticOption = result.getCosmeticOption();
            this.recordFrameInjection(referrerUrl, tabId, frameId, cosmeticOption);
        }
    }

    private onResponseStarted(details: WebRequest.OnResponseStartedDetailsType): WebRequestEventResponse {
        const { requestType, tabId, frameId } = preprocessRequestDetails(details);

        if (requestType === RequestType.Document){
            this.injectJsScript(tabId, frameId);
        }
    }

    private onErrorOccurred(details: WebRequest.OnErrorOccurredDetailsType): WebRequestEventResponse {
        const { tabId, frameId } = details;

        const frame = tabsApi.getTabFrame(tabId, frameId);

        if (frame?.injection){
            delete frame.injection;
        }
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

    private initOnResponseStarted(): void {
        const filter: WebRequest.RequestFilter = {
            urls: ['<all_urls>'],
        };

        browser.webRequest.onResponseStarted.addListener(this.onResponseStarted, filter);
    }

    private initOnErrorOccurred(): void {
        const filter: WebRequest.RequestFilter = {
            urls: ['<all_urls>'],
        };

        browser.webRequest.onErrorOccurred.addListener(this.onErrorOccurred, filter);
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