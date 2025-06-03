/**
 * @file
 * In the content script, we need access to @adguard/assistant only when
 * the user clicks 'block ad manually'.
 * Therefore, we exclude @adguard/assistant from the bundled content-script code
 * and load it on-demand. We also added a required field to the configuration
 * object to ensure the assistant is bundled inside the final extension,
 * allowing tswebextension to load it on-demand.
 *
 * Schema:
 * - Buildtime:
 *  -- [tswebext]  Script to inject assistant from the URL provided by the extension.
 *  -- [tswebext]  Assistant management script for interacting with the assistant.
 *  -- [tswebext]  Assistant messages listener on the content-script side. <--- current file.
 *  -- [extension] Entry point script for injecting the assistant
 * - Runtime:
 *  -- [tswebext] Content script injects into every new tab without the assistant.
 *  -- [tswebext] On-demand content script dynamically injects the assistant.
 *  -- [tswebext] After injection, the content script interacts with the assistant.
 *
 * Reference code: ASSISTANT_INJECT.
 */

import browser from 'webextension-polyfill';

// Import directly from files to avoid side effects of tree shaking.
import { MessageType } from '../../message-constants';
import { logger } from '../../utils/logger';
import { sendAppMessage } from '../send-app-message';

import { hasTypeField } from './message-type-guards';

interface CustomWindow extends Window {
    isAssistantInitiated: boolean;
}

const customWindow: CustomWindow = window as unknown as CustomWindow;

/**
 * Creates handlers for assistant messages.
 */
export const createAssistantMessageListener = (): void => {
    // Check, that script executed in the top frame
    if (window.top !== window || !(document.documentElement instanceof HTMLElement)) {
        return;
    }

    // Create assistant message listener only once.
    if (customWindow.isAssistantInitiated) {
        return;
    }

    browser.runtime.onMessage.addListener(async (message): Promise<undefined> => {
        if (!hasTypeField(message)) {
            logger.warn('[tsweb.assistant-listener]: message do not contain required field "type": ', message);
            return;
        }

        switch (message.type) {
            case MessageType.InitAssistant: {
                // If there is no assistant on the window after execute
                // loading script - throw error.
                if (window.adguardAssistant === undefined) {
                    throw new Error('adguardAssistant not found in the window object.');
                } else {
                    window.adguardAssistant.close();
                }

                window.adguardAssistant.start(null, async (ruleText: string) => {
                    const res = await sendAppMessage({
                        type: MessageType.AssistantCreateRule,
                        payload: { ruleText },
                    });
                    if (!res) {
                        logger.warn(`[tsweb.assistant-listener]: rule '${ruleText}' has not been applied.`);
                    }
                });

                break;
            }
            case MessageType.CloseAssistant: {
                if (window.adguardAssistant) {
                    window.adguardAssistant.close();
                }
                break;
            }
            default: {
                logger.error(`[tsweb.assistant-listener]: not found handler for message type '${message.type}'`);
            }
        }
    });

    customWindow.isAssistantInitiated = true;
};
