import { RequestType } from '@adguard/tsurlfilter'
import { WebRequest } from 'webextension-polyfill'
import { ContentType, resourceToRequestTypeDataMap } from './request-type'
import { tabsApi } from './tabs';

export interface ExtendedDetailsData {
    /**
     * ID of frame where request is executed
     */
    requestFrameId: number;

    /**
     * The origin where the request was initiated
     */
    referrerUrl?: string;

    /**
     * Content type {@link ContentType}
     */
    contentType: ContentType;

    /**
     * TsUrlFilter Request type {@link RequestType}
     */
    requestType: RequestType;

}

export type RequestDetailsType =
    | WebRequest.OnBeforeRequestDetailsType
    | WebRequest.OnBeforeSendHeadersDetailsType
    | WebRequest.OnHeadersReceivedDetailsType
    | WebRequest.OnBeforeRequestDetailsType;

export const getExtendedRequestDetails = <T extends RequestDetailsType>(details: T): T & ExtendedDetailsData => {
    /**
     * FF sends http instead of ws protocol at the http-listeners layer
     * Although this is expected, as the Upgrade request is indeed an HTTP request,
     * we use a chromium based approach in this case.
     */
    if (details.type === 'websocket' && details.url.indexOf('http') === 0) {
        details.url = details.url.replace(/^http(s)?:/, 'ws$1:');
    }

    const { requestType, contentType } = resourceToRequestTypeDataMap[details.type];

    let requestFrameId = details.type === 'main_frame'
        ? details.frameId
        : details.parentFrameId;

    // Relate request to main_frame
    if (requestFrameId === -1) {
        requestFrameId = 0;
    }

    let referrerUrl = details.originUrl
        || details.initiator
        || getReferrerUrl(details.tabId, details.frameId);

    return Object.assign(details, {
        requestFrameId,
        referrerUrl,
        requestType,
        contentType
    });
}
/**
 * get referrer url from frame data
 */
const getReferrerUrl = (tabId: number, frameId: number): string | undefined => {
    const { getTabFrame, getTabMainFrame } = tabsApi;
    let frame = getTabFrame(tabId, frameId) || getTabMainFrame(tabId);

    return frame?.url;
}


