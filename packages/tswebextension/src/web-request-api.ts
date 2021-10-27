/* eslint-disable @typescript-eslint/no-unused-vars */
import browser, { WebRequest, WebNavigation } from 'webextension-polyfill';
import { NetworkRule, RequestType } from '@adguard/tsurlfilter';

import { engineApi } from './engine-api';
import { tabsApi } from './tabs';
import { isOwnUrl, isHttpOrWsRequest } from './utils';
import { getExtendedRequestDetails } from './request-details';

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
        this.onCommittedCheckFrameUrl = this.onCommittedCheckFrameUrl.bind(this);

    }

    public start(): void {
        this.initBeforeRequestEventListener();
        this.initCspReportRequestsEventListener();
        this.initBeforeSendHeadersEventListener();
        this.initHeadersReceivedEventListener();
        this.initCommittedCheckFrameUrlEventListener();
    }

    public stop(): void {
        browser.webRequest.onBeforeRequest.removeListener(this.onBeforeRequest);
        browser.webRequest.onBeforeRequest.removeListener(this.handleCspReportRequests);
        browser.webRequest.onBeforeSendHeaders.removeListener(this.onBeforeSendHeaders);
        browser.webRequest.onHeadersReceived.removeListener(this.onHeadersReceived);
        browser.webNavigation.onCommitted.removeListener(this.onCommittedCheckFrameUrl);
    }

    private onBeforeRequest(details: WebRequest.OnBeforeRequestDetailsType): WebRequestEventResponse {
        const {
            url,
            referrerUrl,
            requestType,
            tabId,
        } = getExtendedRequestDetails(details);

        if (isOwnUrl(referrerUrl)
            || !isHttpOrWsRequest(url)) {
            return;
        }

        let frameRule: NetworkRule | null = null;

        if (requestType === RequestType.Document) {
            frameRule = engineApi.matchFrame(url);
            if (frameRule) {
                tabsApi.setTabFrameRule(tabId, frameRule);
            }
        } else {
            frameRule = tabsApi.getTabFrameRule(tabId);
        }

        const result = engineApi.matchRequest({
            requestUrl: url,
            frameUrl: referrerUrl || url,
            requestType,
            frameRule,
        });

        if (!result) {
            return;
        }

        const basicResult = result.getBasicResult();

        if (basicResult && !basicResult.isAllowlist()) {
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