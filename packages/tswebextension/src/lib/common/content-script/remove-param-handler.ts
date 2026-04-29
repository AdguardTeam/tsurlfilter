import { MessageType } from '../message-constants';

import { REMOVEPARAM_REQUEST_TYPE, REMOVEPARAM_RESPONSE_TYPE } from './remove-param-main-world';
import { sendAppMessage } from './send-app-message';

/**
 * Handles `postMessage` events from the main-world patching script.
 * Forwards the URL to the background for `$removeparam` evaluation and
 * posts the cleaned URL back to the main world.
 *
 * @param event MessageEvent received on the window.
 */
function handleMessage(event: MessageEvent): void {
    if (event.data?.type !== REMOVEPARAM_REQUEST_TYPE) {
        return;
    }

    const { url, requestId } = event.data;

    if (typeof url !== 'string' || typeof requestId !== 'number') {
        return;
    }

    sendAppMessage({
        type: MessageType.GetRemoveParamUrl,
        payload: { url },
    })
        .then((cleanedUrl: string | null) => {
            window.postMessage({
                type: REMOVEPARAM_RESPONSE_TYPE,
                cleanedUrl,
                requestId,
            }, '*');
        })
        .catch(() => {
            // Silently ignore — the extension may be shutting down
            // or the message channel may be broken.
        });
}

/**
 * Initializes the isolated-world bridge for `$removeparam` History API support.
 *
 * The main-world patching script ({@link patchHistoryForRemoveParam}) sends
 * `postMessage` requests whenever `pushState` or `replaceState` is called.
 * This bridge listens for those requests, forwards the URL to the background
 * via {@link MessageType.GetRemoveParamUrl}, and posts the cleaned URL back
 * to the main world.
 */
export function initRemoveParamBridge(): void {
    window.addEventListener('message', handleMessage);
}
