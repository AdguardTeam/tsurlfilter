import browser from 'webextension-polyfill';

import { MessageType, MESSAGE_HANDLER_NAME } from '../message-constants';

// TODO check if we can return typed message here
/**
 * Sends message to the background page.
 *
 * @param message Message to send.
 * @param message.payload Payload of the message.
 * @param message.type Message type.
 *
 * @returns Promise resolved with response from the background page.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const sendAppMessage = async (message: { type: MessageType, payload?: unknown }): Promise<any> => {
    return browser.runtime.sendMessage({ handlerName: MESSAGE_HANDLER_NAME, ...message });
};
