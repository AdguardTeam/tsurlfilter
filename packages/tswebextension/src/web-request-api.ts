/* eslint-disable @typescript-eslint/no-unused-vars */
import browser, { WebRequest, WebNavigation } from 'webextension-polyfill';

export type WebRequestEventResponce = WebRequest.BlockingResponseOrPromise | void;

export class WebRequestApi {
    private static ALL_URLS_REQUEST_FILTER = {
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
        // TODO: implement
        return;
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
}
