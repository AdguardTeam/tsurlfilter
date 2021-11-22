import browser, { WebRequest } from 'webextension-polyfill';
import { OriginalRequestEvent, RequestEvent } from './request-event';

export type OnCompleted = OriginalRequestEvent<
WebRequest.OnCompletedDetailsType,
WebRequest.OnCompletedOptions
>;

export const onCompleted = new RequestEvent(
    browser.webRequest.onCompleted as OnCompleted,
    (callback) => {
        return (details) => {
            return callback({ details });
        };
    },
);