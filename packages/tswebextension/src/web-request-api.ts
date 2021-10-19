/* eslint-disable @typescript-eslint/no-unused-vars */
import { RequestType } from '@adguard/tsurlfilter'
import browser, { WebRequest, WebNavigation } from 'webextension-polyfill';

import { engineApi } from './engine-api';

export type WebRequestEventResponce = WebRequest.BlockingResponseOrPromise | void;

export interface WebRequestApiInterface {
    init: () => void;
}
export class WebRequestApi implements WebRequestApiInterface {
    private static ALL_URLS_REQUEST_FILTER: WebRequest.RequestFilter = {
        urls: ['<all_urls>'],
    };

    public init(): void {
        this.initBeforeRequestEventListener();
        this.initCspReportRequestsEventListener();
        this.initBeforeSendHeadersEventListener();
        this.initHeadersReceivedEventListener();
        this.initCommittedCheckFrameUrlEventListener();
    }


    private onBeforeRequest(details: WebRequest.OnBeforeRequestDetailsType): WebRequestEventResponce {
        const { url, documentUrl, type } = details;

        const responce = engineApi.matchRequest({
            requestUrl: url,
            frameUrl: documentUrl || url,
            requestType: WebRequestApi.transformResourceTypeToTsUrlFilterRequestType(type),
            frameRule: null,
        })
        
        console.log(responce);
    }

    private onBeforeSendHeaders(details: WebRequest.OnBeforeSendHeadersDetailsType): WebRequestEventResponce {
        // TODO: implement
        return;
    }

    private onHeadersReceived(details: WebRequest.OnHeadersReceivedDetailsType): WebRequestEventResponce {
        // TODO: implement
        return;
    }

    private handleCspReportRequests(details: WebRequest.OnBeforeRequestDetailsType): WebRequestEventResponce {
        // TODO: implement
        return;
    } 


    private onCommittedCheckFrameUrl(details: WebNavigation.OnCommittedDetailsType): void {
        // TODO: implement
        return;
    }

    private initBeforeRequestEventListener(): void {
        browser.webRequest.onBeforeRequest.addListener(
            this.onBeforeRequest,
            WebRequestApi.ALL_URLS_REQUEST_FILTER,
        );
    }

    /**
     * Handler for csp reports urls
     */
    private initCspReportRequestsEventListener(): void {
        const requestFilter = {
            ...WebRequestApi.ALL_URLS_REQUEST_FILTER,
            types: ['csp_report'],
        } as WebRequest.RequestFilter;

        const extraInfoSpec = ['requestBody'] as WebRequest.OnBeforeRequestOptions[];

        browser.webRequest.onBeforeRequest.addListener(
            this.handleCspReportRequests,
            requestFilter,
            extraInfoSpec,
        );
    }

    private initBeforeSendHeadersEventListener(): void {
        browser.webRequest.onBeforeSendHeaders.addListener(
            this.onBeforeSendHeaders,
            WebRequestApi.ALL_URLS_REQUEST_FILTER,
        );
    }

    private initHeadersReceivedEventListener(): void {
        browser.webRequest.onHeadersReceived.addListener(
            this.onHeadersReceived,
            WebRequestApi.ALL_URLS_REQUEST_FILTER,
        );
    }

    private initCommittedCheckFrameUrlEventListener(): void {
        browser.webNavigation.onCommitted.addListener(this.onCommittedCheckFrameUrl);
    }

    private static transformResourceTypeToTsUrlFilterRequestType(resourceType: WebRequest.ResourceType): RequestType {
        switch (resourceType) {
            case 'main_frame':
                return RequestType.Document;
            case 'sub_frame':
                return RequestType.Subdocument;
            case 'stylesheet':
                return RequestType.Stylesheet;
            case 'font':
                return RequestType.Font;
            case 'image':
                return RequestType.Image;
            case 'media':
                return RequestType.Media;
            case 'script':
                return RequestType.Script;
            case 'xmlhttprequest':
                return RequestType.XmlHttpRequest;
            case 'websocket':
                return RequestType.Websocket;
            case 'ping':
            case 'beacon':
                return RequestType.Ping;
            default:
                return RequestType.Other;
        }
    }
}

export const webRequestApi = new WebRequestApi();