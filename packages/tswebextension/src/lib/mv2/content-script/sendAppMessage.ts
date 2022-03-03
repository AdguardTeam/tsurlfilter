import browser from 'webextension-polyfill';
import { MessageType, MESSAGE_HANDLER_NAME } from '../../common';

export const sendAppMessage = (message: { type: MessageType, payload?: unknown }) => {
    return browser.runtime.sendMessage({ handlerName: MESSAGE_HANDLER_NAME, ...message });
};
