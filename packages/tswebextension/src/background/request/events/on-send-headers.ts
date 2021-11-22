import browser, { WebRequest } from 'webextension-polyfill';
import { OriginalRequestEvent, RequestEvent } from './request-event';

export type OnSendHeaders = OriginalRequestEvent<
WebRequest.OnSendHeadersDetailsType,
WebRequest.OnSendHeadersOptions
>;

export const onSendHeaders = new RequestEvent(
    browser.webRequest.onSendHeaders as OnSendHeaders,
    (callback) => {
        return (details) => {
            return callback({ details });
        };
    },
);
