import browser from 'webextension-polyfill';
import { adguardAssistant, Assistant } from '@adguard/assistant';
import { MessageType, sendAppMessage } from '../../common';

/**
 * Initializes assistant object
 */
export const initAssistant = () => {
    if (window.top !== window || !(document.documentElement instanceof HTMLElement)) {
        return;
    }

    let assistant: Assistant;

    browser.runtime.onMessage.addListener((message) => {
        switch (message.type) {
            case MessageType.INIT_ASSISTANT: {
                if (!assistant) {
                    assistant = adguardAssistant();
                } else {
                    assistant.close();
                }

                assistant.start(null, (rules) => {
                    sendAppMessage({
                        type: MessageType.ASSISTANT_CREATE_RULE,
                        payload: { ruleText: rules },
                    });
                });
                break;
            }
            case MessageType.CLOSE_ASSISTANT: {
                if (assistant) {
                    assistant.close();
                }
                break;
            }
            default:
                break;
        }
    });
};
