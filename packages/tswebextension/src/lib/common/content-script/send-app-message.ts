import browser from 'webextension-polyfill';
import { MessageType, MESSAGE_HANDLER_NAME } from '../message';

export const sendAppMessage = async (message: { type: MessageType, payload?: unknown }) => {
    return browser.runtime.sendMessage({ handlerName: MESSAGE_HANDLER_NAME, ...message });
};
