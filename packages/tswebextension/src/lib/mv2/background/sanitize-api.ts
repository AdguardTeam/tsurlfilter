import { WebRequest } from 'webextension-polyfill';
import { isExtensionUrl } from '../../common';
import { RequestContext, BACKGROUND_TAB_ID } from './request';
import { removeHeader } from './utils';

export class SanitizeApi {
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
