import { EventChannel, MessageType } from '../../common';
import { messagesApi } from './messages-api';

export class Assistant {
    public static onCreateRule = new EventChannel<string>();

    public static async openAssistant(tabId: number): Promise<void> {
        await messagesApi.sendMessage(tabId, {
            type: MessageType.INIT_ASSISTANT,
        });
    }

    public static async closeAssistant(tabId: number): Promise<void> {
        await messagesApi.sendMessage(tabId, {
            type: MessageType.CLOSE_ASSISTANT,
        });
    }
}
