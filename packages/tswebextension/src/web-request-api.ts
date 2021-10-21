/* eslint-disable @typescript-eslint/no-unused-vars */
import browser, { WebRequest, WebNavigation } from 'webextension-polyfill';
import { NetworkRule } from '@adguard/tsurlfilter';

import { engineApi } from './engine-api';
import { tabsApi } from './tabs-api';
import { isOwnUrl } from './utils';
import { transformResourceType } from './request-type';

export type WebRequestEventResponse = WebRequest.BlockingResponseOrPromise | void;

export interface WebRequestApi {
    start: () => void;
    stop: () => void;
}

export const webRequestApi = (function (): WebRequestApi {
    function onBeforeRequest(details: WebRequest.OnBeforeRequestDetailsType): WebRequestEventResponse {
        const { url, documentUrl, originUrl, type, tabId } = details;

        if (isOwnUrl(originUrl || documentUrl || url)){
            return;
        }

        let frameRule = null;

        if (type === 'main_frame') {
            frameRule = engineApi.matchFrame(url);
            if (frameRule){
                tabsApi.updateTabMetadata(tabId, { frameRule });
            }
        } else {
            const tabContext = tabsApi.getTabContext(tabId);
            if (tabContext?.metadata?.frameRule){
                frameRule = tabContext.metadata.frameRule as NetworkRule;
            }
        }

        const result = engineApi.matchRequest({
            requestUrl: url,
            frameUrl: documentUrl || url,
            requestType: transformResourceType(type),
            frameRule,
        });

        if (!result){
            return;
        }

        const basicResult = result.getBasicResult();
        
        if (basicResult && !basicResult.isAllowlist()){
            return { cancel: true };
        }

        return;
    }

    function onBeforeSendHeaders(details: WebRequest.OnBeforeSendHeadersDetailsType): WebRequestEventResponse {
        // TODO: implement
        return;
    }

    function onHeadersReceived(details: WebRequest.OnHeadersReceivedDetailsType): WebRequestEventResponse {
        // TODO: implement
        return;
    }

    function handleCspReportRequests(details: WebRequest.OnBeforeRequestDetailsType): WebRequestEventResponse {
        // TODO: implement
        return;
    } 


    function onCommittedCheckFrameUrl(details: WebNavigation.OnCommittedDetailsType): void {
        // TODO: implement
        return;
    }

    function initBeforeRequestEventListener(): void {
        const filter: WebRequest.RequestFilter = {
            urls: ['<all_urls>'],
        };

        const extraInfoSpec: WebRequest.OnBeforeRequestOptions[] = ['blocking'];

        browser.webRequest.onBeforeRequest.addListener(
            onBeforeRequest,
            filter,
            extraInfoSpec,
        );
    }

    /**
     * Handler for csp reports urls
     */
    function initCspReportRequestsEventListener(): void {
        const filter: WebRequest.RequestFilter = {
            urls: ['<all_urls>'],
            types: ['csp_report'],
        }; 

        const extraInfoSpec: WebRequest.OnBeforeRequestOptions[] = ['requestBody'];

        browser.webRequest.onBeforeRequest.addListener(
            handleCspReportRequests,
            filter,
            extraInfoSpec,
        );
    }

    function initBeforeSendHeadersEventListener(): void {
        const filter: WebRequest.RequestFilter = {
            urls: ['<all_urls>'],
        }; 

        browser.webRequest.onBeforeSendHeaders.addListener(
            onBeforeSendHeaders,
            filter,
        );
    }

    function initHeadersReceivedEventListener(): void {
        const filter: WebRequest.RequestFilter = {
            urls: ['<all_urls>'],
        }; 

        const extraInfoSpec: WebRequest.OnHeadersReceivedOptions[] = ['responseHeaders', 'blocking'];

        browser.webRequest.onHeadersReceived.addListener(
            onHeadersReceived,
            filter,
            extraInfoSpec,
        );
    }

    function initCommittedCheckFrameUrlEventListener(): void {
        browser.webNavigation.onCommitted.addListener(onCommittedCheckFrameUrl);
    }

    function start(): void {
        initBeforeRequestEventListener();
        initCspReportRequestsEventListener();
        initBeforeSendHeadersEventListener();
        initHeadersReceivedEventListener();
        initCommittedCheckFrameUrlEventListener();
    }

    function stop(): void {
        browser.webRequest.onBeforeRequest.removeListener(onBeforeRequest);
        browser.webRequest.onBeforeRequest.removeListener(handleCspReportRequests);
        browser.webRequest.onBeforeSendHeaders.removeListener(onBeforeSendHeaders);
        browser.webRequest.onHeadersReceived.removeListener(onHeadersReceived);
        browser.webNavigation.onCommitted.removeListener(onCommittedCheckFrameUrl);
    }

    return {
        start,
        stop,
    };
})();