import browser, { WebRequest } from 'webextension-polyfill';
import { OriginalRequestEvent, RequestEvent } from './request-event';

export type OnAuthRequired = OriginalRequestEvent<
WebRequest.OnAuthRequiredDetailsType,
WebRequest.OnAuthRequiredOptions
>;

export const onAuthRequired = new RequestEvent(
    browser.webRequest.onAuthRequired as OnAuthRequired,
    (callback) => (details) => {
        return callback({ details });
    },
);
