import browser, { WebRequest } from 'webextension-polyfill';

import { requestContextStorage } from '../request-context-storage';
import { OriginalRequestEvent, RequestEvent } from './request-event';

export type OnCompleted = OriginalRequestEvent<
WebRequest.OnCompletedDetailsType,
WebRequest.OnCompletedOptions
>;

export const onCompleted = new RequestEvent(
    browser.webRequest.onCompleted as OnCompleted,
    (callback) => {
        return (details) => {
            const { requestId } = details;
            const context = requestContextStorage.get(requestId);
            return callback({ details, context });
        };
    },
);