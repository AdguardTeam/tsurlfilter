import { type WebRequest } from 'webextension-polyfill';

import { removeHeader } from '../../common/utils/headers';
import { isExtensionUrl } from '../../common/utils/url';
import { BACKGROUND_TAB_ID } from '../../common/constants';

import { type RequestContext } from './request';

/**
 * This API is used to remove traceable data from requests initiated by the background extension.
 */
export class SanitizeApi {
    /**
     * Removes Cookie headers from background extension's requests.
     *
     * @param context Request context.
     *
     * @returns Blocking response or null.
     */
    public static onBeforeSendHeaders(context: RequestContext): WebRequest.BlockingResponseOrPromise | null {
        const {
            requestHeaders,
            referrerUrl,
            tabId,
        } = context;

        if (tabId !== BACKGROUND_TAB_ID || !requestHeaders) {
            return null;
        }

        // removeHeader modifies 'context.requestHeaders'
        if (isExtensionUrl(referrerUrl) && removeHeader(requestHeaders, 'Cookie')) {
            return { requestHeaders };
        }

        return null;
    }
}
