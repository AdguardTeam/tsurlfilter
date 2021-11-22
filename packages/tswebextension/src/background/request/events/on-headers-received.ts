import browser, { WebRequest } from 'webextension-polyfill';
import { requestContextStorage } from '../request-context-storage';
import { OriginalRequestEvent, RequestEvent } from './request-event';

export type OnHeadersReceived = OriginalRequestEvent<
WebRequest.OnHeadersReceivedDetailsType,
WebRequest.OnHeadersReceivedOptions
>;

export const onHeadersReceived = new RequestEvent(
    browser.webRequest.onHeadersReceived as OnHeadersReceived,
    (callback) => {
        return (details) => {
            const { requestId } = details;
            const context = requestContextStorage.get(requestId);
            return callback({ details, context });
        };
    },
);