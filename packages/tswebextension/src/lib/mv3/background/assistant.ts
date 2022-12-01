import { EventChannel, MessageType } from '../../common';

import MessagesApi from './messages-api';

/**
 * Assistant class is the handler of messages and events related
 * to AdGuard assistant.
 */
export class Assistant {
    /**
     * Fires when a rule has been created from the AdGuard assistant.
     */
    public static onCreateRule = new EventChannel<string>();

    /**
     * Opens the AdGuard assistant in the specified tab.
     *
     * @param tabId The ID of the tab where is needed to open
     * the AdGuard assistant.
     */
    public static async openAssistant(tabId: number): Promise<void> {
        await MessagesApi.sendMessageToTab(tabId, {
            type: MessageType.INIT_ASSISTANT,
        });
    }

    /**
     * Closes the AdGuard assistant in the specified tab.
     *
     * @param tabId The ID of the tab where is needed to close
     * the AdGuard assistant.
     */
    public static async closeAssistant(tabId: number): Promise<void> {
        await MessagesApi.sendMessageToTab(tabId, {
            type: MessageType.CLOSE_ASSISTANT,
        });
    }
}
