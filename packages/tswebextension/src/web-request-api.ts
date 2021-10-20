/* eslint-disable @typescript-eslint/no-unused-vars */
import browser, { WebRequest, WebNavigation } from 'webextension-polyfill';

import { engineApi } from './engine-api';
import { isOwnRequest } from './background';
import { transformResourceType } from './request-type';

export type WebRequestEventResponse = WebRequest.BlockingResponseOrPromise | void;

export interface WebRequestApiInterface {
    init: () => void;
}
export class WebRequestApi implements WebRequestApiInterface {
    public init(): void {
        this.initBeforeRequestEventListener();
        this.initCspReportRequestsEventListener();
        this.initBeforeSendHeadersEventListener();
        this.initHeadersReceivedEventListener();
        this.initCommittedCheckFrameUrlEventListener();
    }


    private onBeforeRequest(details: WebRequest.OnBeforeRequestDetailsType): WebRequestEventResponse {
        const { url, documentUrl, originUrl, type } = details;

        if(isOwnRequest(originUrl || documentUrl || url)){
            return;
        }

        const result = engineApi.matchRequest({
            requestUrl: url,
            frameUrl: documentUrl || url,
            requestType: transformResourceType(type),
            frameRule: null,
        })

        if(!result){
            return;
        }

        const basicResult = result.getBasicResult()
        
        if(basicResult && !basicResult.isAllowlist()){
            return { cancel: true };
        }

        return;
    }

    private onBeforeSendHeaders(details: WebRequest.OnBeforeSendHeadersDetailsType): WebRequestEventResponse {
        // TODO: implement
        return;
    }

    private onHeadersReceived(details: WebRequest.OnHeadersReceivedDetailsType): WebRequestEventResponse {
        // TODO: implement
        return;
    }

    private handleCspReportRequests(details: WebRequest.OnBeforeRequestDetailsType): WebRequestEventResponse {
        // TODO: implement
        return;
    } 


    private onCommittedCheckFrameUrl(details: WebNavigation.OnCommittedDetailsType): void {
        // TODO: implement
        return;
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

    private initCommittedCheckFrameUrlEventListener(): void {
        browser.webNavigation.onCommitted.addListener(this.onCommittedCheckFrameUrl);
    }
}

export const webRequestApi = new WebRequestApi();