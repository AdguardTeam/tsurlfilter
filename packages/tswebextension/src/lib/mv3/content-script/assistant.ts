import { adguardAssistant, Assistant } from '@adguard/assistant';

import { MessageType } from '../../common/message-constants';
import { sendAppMessage } from '../../common/content-script/send-app-message';
import { logger } from '../utils/logger';

/**
 * Initializes assistant object.
 */
export const initAssistant = (): void => {
    // Check, that script executed in the top frame
    if (window.top !== window || !(document.documentElement instanceof HTMLElement)) {
        return;
    }

    let assistant: Assistant;

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        switch (message.type) {
            case MessageType.INIT_ASSISTANT: {
                if (typeof assistant === 'undefined') {
                    assistant = adguardAssistant();
                } else {
                    assistant.close();
                }

                assistant.start(null, async (ruleText: string) => {
                    const res = await sendAppMessage({
                        type: MessageType.ASSISTANT_CREATE_RULE,
                        payload: { ruleText },
                    });
                    if (!res) {
                        logger.debug(`Rule '${ruleText}' has not been applied.`);
                    }
                });
                sendResponse(true);
                break;
            }
            case MessageType.CLOSE_ASSISTANT: {
                if (assistant) {
                    assistant.close();
                    sendResponse(true);
                }
                break;
            }
            default: {
                logger.debug(`Not found handler for message type '${message.type}'`);
                sendResponse(false);
            }
        }
    });
};
