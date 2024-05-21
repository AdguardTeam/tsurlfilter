import { adguardAssistant, type Assistant } from '@adguard/assistant';

import { MessageType } from '../../common/message-constants';
import { sendAppMessage } from '../../common/content-script/send-app-message';
import { logger } from '../utils/logger';
import browser from 'webextension-polyfill';

/**
 * Initializes assistant object.
 */
export const initAssistant = (): void => {
    // Check, that script executed in the top frame
    if (window.top !== window || !(document.documentElement instanceof HTMLElement)) {
        return;
    }

    let assistant: Assistant;

    browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
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
                        logger.debug(`Rule '${ruleText}' has not been applied.`);
                    }
                });
                // FIXME types later
                // @ts-ignore
                sendResponse(true);
                break;
            }
            case MessageType.CloseAssistant: {
                if (assistant) {
                    assistant.close();
                    // FIXME types later
                    // @ts-ignore
                    sendResponse(true);
                }
                break;
            }
            default: {
                logger.debug(`Not found handler for message type '${message.type}'`);
                // FIXME types later
                // @ts-ignore
                sendResponse(false);
            }
        }
    });
};
