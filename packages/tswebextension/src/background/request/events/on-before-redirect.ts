import browser, { WebRequest } from 'webextension-polyfill';
import { OriginalRequestEvent, RequestEvent } from './request-event';

export type OnBeforeRedirect = OriginalRequestEvent<
WebRequest.OnBeforeRedirectDetailsType,
WebRequest.OnBeforeRedirectOptions
>;

export const onBeforeRedirect = new RequestEvent(
    browser.webRequest.onBeforeRedirect as OnBeforeRedirect,
    (callback) => (details) => {
        return callback({ details });
    },
);