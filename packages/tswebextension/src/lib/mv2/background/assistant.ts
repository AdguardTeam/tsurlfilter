import { EventChannel, MessageType } from '../../common';
import { messagesApi } from './messages-api';

export class Assistant {
    public static onCreateRule = new EventChannel<string>();

    public static openAssistant(tabId: number): void {
        messagesApi.sendMessage(tabId, {
            type: MessageType.INIT_ASSISTANT,
        });
    }

    public static closeAssistant(tabId: number): void {
        messagesApi.sendMessage(tabId, {
            type: MessageType.CLOSE_ASSISTANT,
        });
    }
}
