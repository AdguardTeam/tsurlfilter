import browser from 'webextension-polyfill';
import { EventChannel, MessageType } from '../../common';
import { messagesApi } from './messages-api';

/**
 * Event channel wrapper for sending messages to assistant.
 */
export class Assistant {
    public static onCreateRule = new EventChannel<string>();

    /**
     * Path to assembled @adguard/assistant module. Necessary for lazy on-demand
     * loading of the assistant.
     */
    public static assistantUrl = '';

    /**
     * Sends message to assistant to open it on the page.
     *
     * @param tabId Tab id.
     */
    public static async openAssistant(tabId: number): Promise<void> {
        // Lazy load assistant
        await browser.tabs.executeScript(
            tabId,
            { file: this.assistantUrl },
        );

        await messagesApi.sendMessage(tabId, {
            type: MessageType.INIT_ASSISTANT,
            tabId,
            assistantUrl: this.assistantUrl,
        });
    }

    /**
     * Sends message to assistant to close it on the page.
     *
     * @param tabId Tab id.
     */
    public static async closeAssistant(tabId: number): Promise<void> {
        await messagesApi.sendMessage(tabId, {
            type: MessageType.CLOSE_ASSISTANT,
        });
    }
}
