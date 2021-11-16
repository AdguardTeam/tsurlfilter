import { RequestType, isThirdPartyRequest } from '@adguard/tsurlfilter';
import { WebRequest } from 'webextension-polyfill';
import { ContentType, getRequestType } from './request-type';
import { getDomain } from '../utils';

export interface ExtendedDetailsData {
    /**
     * ID of frame where request is executed
     */
    requestFrameId: number;

    /**
     * The origin where the request was initiated
     */
    referrerUrl: string;

    /**
     * Content type {@link ContentType}
     */
    contentType: ContentType;

    /**
     * TsUrlFilter Request type {@link RequestType}
     */
    requestType: RequestType;

    /**
     * Indicates if this request and its content window hierarchy is third party.
     */
    thirdParty: boolean;

}

export type RequestDetailsType =
    | WebRequest.OnBeforeRequestDetailsType
    | WebRequest.OnBeforeSendHeadersDetailsType
    | WebRequest.OnHeadersReceivedDetailsType
    | WebRequest.OnBeforeRequestDetailsType
    | WebRequest.OnResponseStartedDetailsType;

export const MAX_URL_LENGTH = 1024 * 16;

export const preprocessRequestDetails = <T extends RequestDetailsType>(details: T): T & ExtendedDetailsData => {

    const {
        type,
        frameId,
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

    return Object.assign(details, {
        requestFrameId,
        referrerUrl,
        requestType,
        contentType,
        thirdParty,
    });
};
