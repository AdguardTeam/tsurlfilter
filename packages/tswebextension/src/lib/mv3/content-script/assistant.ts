import { adguardAssistant, type Assistant } from '@adguard/assistant';
import browser from 'webextension-polyfill';

import { MessageType } from '../../common/message-constants';
import { sendAppMessage } from '../../common/content-script/send-app-message';
import { logger } from '../../common/utils/logger';
import { type Message } from '../../common/message';

// Simple type guard for message object with 'type' field.
// Added to no bring here huge zod library.
const hasTypeField = (message: unknown): message is Pick<Message, 'type'> => {
    return typeof message === 'object' && message !== null && 'type' in message;
};

/**
 * Initializes assistant object.
 */
export const initAssistant = (): void => {
    // Check, that script executed in the top frame
    if (window.top !== window || !(document.documentElement instanceof HTMLElement)) {
        return;
    }

    let assistant: Assistant;

    browser.runtime.onMessage.addListener((message, sender, sendResponse): undefined => {
        if (!hasTypeField(message)) {
            return;
        }

        switch (message.type) {
            case MessageType.InitAssistant: {
                if (typeof assistant === 'undefined') {
                    assistant = adguardAssistant();
                } else {
                    assistant.close();
                }

                assistant.start(null, async (ruleText: string) => {
                    const res = await sendAppMessage({
                        type: MessageType.AssistantCreateRule,
                        payload: { ruleText },
                    });
                    if (!res) {
                        logger.debug(`[tswebextension.initAssistant]: rule '${ruleText}' has not been applied.`);
                    }
                });
                sendResponse(true);
                break;
            }
            case MessageType.CloseAssistant: {
                if (assistant) {
                    assistant.close();
                    sendResponse(true);
                }
                break;
            }
            default: {
                logger.debug(`[tswebextension.initAssistant]: not found handler for message type '${message.type}'`);
                sendResponse(false);
            }
        }
    });
};
