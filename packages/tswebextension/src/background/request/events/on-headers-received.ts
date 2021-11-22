import browser, { WebRequest } from 'webextension-polyfill';
import { OriginalRequestEvent, RequestEvent } from './request-event';

export type OnHeadersReceived = OriginalRequestEvent<
WebRequest.OnHeadersReceivedDetailsType,
WebRequest.OnHeadersReceivedOptions
>;

export const onHeadersReceived = new RequestEvent(
    browser.webRequest.onHeadersReceived as OnHeadersReceived,
    (callback) => {
        return (details) => {
            return callback({ details });
        };
    },
);