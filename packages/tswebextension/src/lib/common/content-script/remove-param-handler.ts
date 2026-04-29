import { MessageType } from '../message-constants';

import { REMOVEPARAM_LOG_TYPE } from './remove-param-main-world';
import { sendAppMessage } from './send-app-message';

/**
 * Whether the log relay has already been initialized.
 */
let initialized = false;

/**
 * Initializes the `$removeparam` log-relay listener in the isolated world.
 *
 * Listens for {@link REMOVEPARAM_LOG_TYPE} events posted from the main world
 * (where `patchHistoryForRemoveParam` runs) and forwards them to the
 * background as {@link MessageType.LogRemoveParamEvent} messages
 * (fire-and-forget).
 *
 * Safe to call multiple times — only the first call registers the listener.
 */
export function initRemoveParamLogRelay(): void {
    if (initialized) {
        return;
    }
    initialized = true;

    window.addEventListener('message', (event: MessageEvent) => {
        if (event.data?.type !== REMOVEPARAM_LOG_TYPE && event.source !== window) {
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
