import browser, { WebRequest } from 'webextension-polyfill';
import { RequestType } from '@adguard/tsurlfilter';

import { getRequestType } from '../request-type';
import { getDomain, isHttpOrWsRequest, isOwnUrl, isThirdPartyRequest } from '../../utils';
import { OriginalRequestEvent, RequestEvent } from './request-event';
import { requestContextStorage } from '../request-context-storage';
import { tabsApi } from '../../tabs/tabs-api';
import { engineApi } from '../../engine-api';

export type OnBeforeRequest = OriginalRequestEvent<
WebRequest.OnBeforeRequestDetailsType,
WebRequest.OnBeforeRequestOptions
>;

const MAX_URL_LENGTH = 1024 * 16;

export const onBeforeRequest = new RequestEvent(
    browser.webRequest.onBeforeRequest as OnBeforeRequest,
    (callback) => (details) => {
        const {
            requestId,
            type,
            frameId,
            tabId,
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

        if (isOwnUrl(referrerUrl)
            || !isHttpOrWsRequest(url)) {
            return;
        }

        if (requestType === RequestType.Document || requestType === RequestType.Subdocument) {
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

        const context = requestContextStorage.record(requestId, {
            requestUrl: url,
            referrerUrl,
            requestType,
            tabId,
            frameId,
            requestFrameId,
            timestamp: Date.now(),
            matchingResult: result,
            thirdParty,
            contentType,
        });

        return callback({ details, context });
    },
);
