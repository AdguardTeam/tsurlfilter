import { MessageType } from '../message-constants';

import { REMOVEPARAM_LOG_TYPE, REMOVEPARAM_UPDATE_TYPE } from './remove-param-main-world';
import { sendAppMessage } from './send-app-message';

/**
 * Whether the log relay has already been initialized.
 */
let initialized = false;

/**
 * Initializes the `$removeparam` log-relay listener in the isolated world.
 *
 * Main-world scripts (where `patchHistoryForRemoveParam` runs) cannot access
 * extension APIs like `chrome.runtime.sendMessage()`. Instead, they post log
 * events via `window.postMessage()` to the isolated-world content script,
 * which has access to extension messaging and relays them to the background.
 *
 * Listens for {@link REMOVEPARAM_LOG_TYPE} events and forwards them to the
 * background as {@link MessageType.LogRemoveParamEvent} messages
 * (fire-and-forget).
 *
 * A random nonce generated at injection time authenticates messages: only
 * events bearing the correct nonce are forwarded, preventing page scripts
 * from spoofing log events.
 *
 * Safe to call multiple times — only the first call registers the listener.
 *
 * @param nonce Random token shared with the main-world script at injection time.
 */
export function initRemoveParamRelay(nonce: string): void {
    if (initialized) {
        return;
    }
    initialized = true;

    window.addEventListener('message', (event: MessageEvent) => {
        if (
            event.data?.type !== REMOVEPARAM_LOG_TYPE
            || event.source !== window
            || event.data?.nonce !== nonce
        ) {
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

    // Listen for descriptor-update messages from the background and forward
    // them to the main world so `patchHistoryForRemoveParam` can hot-swap
    // its descriptor set without a full re-injection.
    chrome.runtime.onMessage.addListener((message: unknown) => {
        if (
            message !== null
            && typeof message === 'object'
            && (message as Record<string, unknown>).type === REMOVEPARAM_UPDATE_TYPE
            && (message as Record<string, unknown>).nonce === nonce
        ) {
            window.postMessage(message, '*');
        }
    });
}
