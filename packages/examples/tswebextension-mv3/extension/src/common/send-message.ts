import { ExtendedMV3MessageType } from '@adguard/tswebextension/mv3';
import { Message } from '../message';

export const sendMessage = (
    type: Message,
    data: any = null, // eslint-disable-line @typescript-eslint/no-explicit-any
    handlerName = '',
) => {
    return new Promise((resolve) => {
        const callbackWrapper = (response: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
            console.log(`Response for '${type}':`, response);
            resolve(response);
        };
        chrome.runtime.sendMessage({ type, data, handlerName }, callbackWrapper);
    });
};

export const sendInnerMessage = (
    type: ExtendedMV3MessageType,
    handlerName = 'tsWebExtension',
) => {
    return new Promise((resolve) => {
        const callbackWrapper = (response: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
            console.log(`Response for '${type}':`, response);
            resolve(response);
        };
        chrome.runtime.sendMessage({ type, handlerName }, callbackWrapper);
    });
};
