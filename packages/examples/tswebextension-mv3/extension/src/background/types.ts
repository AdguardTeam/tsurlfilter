import { MESSAGE_HANDLER_NAME, MessageType } from '@adguard/tswebextension/mv3';

import { Message } from '../message';

/**
 * Message from the example extension's own UI (popup etc.).
 */
export interface ExampleMessage {
    type: Message;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data?: any;
}

/**
 * Message from tswebextension content scripts.
 */
export interface TsWebExtensionMessage {
    type: MessageType;
    handlerName: typeof MESSAGE_HANDLER_NAME;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    payload?: any;
}

export type MessageLike = ExampleMessage | TsWebExtensionMessage;

export type ConfigResponse = {
    status: boolean;
    filters: number[];
    rules: string;
};

/**
 * Guard: checks whether a message is an {@link ExampleMessage}.
 */
export const isExampleMessage = (message: unknown): message is ExampleMessage => {
    return (message as ExampleMessage).type !== undefined;
};

/**
 * Guard: checks whether a message is a {@link TsWebExtensionMessage}.
 */
export const isTsWebExtensionMessage = (message: unknown): message is TsWebExtensionMessage => {
    return (message as TsWebExtensionMessage).handlerName === MESSAGE_HANDLER_NAME;
};
