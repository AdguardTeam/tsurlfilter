import { type MessageType } from '@adguard/tswebextension/mv3';
import browser from 'webextension-polyfill';

import { Message } from '../message';

export const sendMessage = async (
    type: Message,
    data: any = null, // eslint-disable-line @typescript-eslint/no-explicit-any
    handlerName = '',
) => {
    const response = await browser.runtime.sendMessage({ type, data, handlerName });
    console.log(`Response for '${type}':`, response);
    return response;
};

export const sendInnerMessage = (
    type: MessageType,
    handlerName = 'tsWebExtension',
) => {
    const response = browser.runtime.sendMessage({ type, handlerName });
    console.log(`Response for '${type}':`, response);
    return response;
};
