import browser, { WebRequest } from 'webextension-polyfill';

import { requestContextStorage } from '../request-context-storage';
import { OriginalRequestEvent, RequestEvent } from './request-event';

export type OnErrorOccurred = OriginalRequestEvent<
WebRequest.OnErrorOccurredDetailsType,
WebRequest.OnErrorOccurredOptions
>;

export const onErrorOccurred = new RequestEvent(
    browser.webRequest.onErrorOccurred as OnErrorOccurred,
    (callback) => {
        return (details) => {
            const { requestId } = details;
            const context = requestContextStorage.get(requestId);
            return callback({ details, context });
        };
    },
);