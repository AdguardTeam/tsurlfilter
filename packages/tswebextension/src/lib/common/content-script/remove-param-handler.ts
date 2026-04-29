import { type RemoveParamDescriptor } from '../message';
import { MessageType } from '../message-constants';

import { REMOVEPARAM_CONFIG_TYPE, REMOVEPARAM_LOG_TYPE } from './remove-param-main-world';
import { sendAppMessage } from './send-app-message';

/**
 * Initializes the `$removeparam` content-script support.
 *
 * 1. Sends a one-time {@link MessageType.GetRemoveParamRules} message to the
 *    background to fetch applicable rule descriptors for the current page.
 * 2. Posts the descriptors to the main world via {@link REMOVEPARAM_CONFIG_TYPE}
 *    so the patched History API methods can apply parameter removal locally.
 * 3. Listens for {@link REMOVEPARAM_LOG_TYPE} events from the main world and
 *    forwards them to the background as {@link MessageType.LogRemoveParamEvent}
 *    messages (fire-and-forget).
 */
export function initRemoveParam(): void {
    // Fetch rules from background and post config to main world.
    sendAppMessage({
        type: MessageType.GetRemoveParamRules,
        payload: { documentUrl: document.location.href },
    })
        .then((descriptors: RemoveParamDescriptor[] | null) => {
            window.postMessage({
                type: REMOVEPARAM_CONFIG_TYPE,
                descriptors: descriptors || [],
            }, '*');
        })
        .catch(() => {
            // Extension may be shutting down — send empty config so main world
            // can unpatch and release resources.
            window.postMessage({
                type: REMOVEPARAM_CONFIG_TYPE,
                descriptors: [],
            }, '*');
        });

    // Listen for log events from the main world.
    window.addEventListener('message', (event: MessageEvent) => {
        if (event.data?.type !== REMOVEPARAM_LOG_TYPE) {
            return;
        }

        const { appliedDescriptors, originalUrl } = event.data;

        if (!Array.isArray(appliedDescriptors) || typeof originalUrl !== 'string') {
            return;
        }

        // Fire-and-forget — no response needed.
        sendAppMessage({
            type: MessageType.LogRemoveParamEvent,
            payload: {
                url: originalUrl,
                appliedDescriptors,
            },
        }).catch(() => {
            // Silently ignore — the extension may be shutting down.
        });
    });
}
