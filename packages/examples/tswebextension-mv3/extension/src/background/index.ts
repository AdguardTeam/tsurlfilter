import browser from 'webextension-polyfill';

import { TsWebExtension } from '@adguard/tswebextension/mv3';

import { subscribeAssistantCreateRule } from './assistant';
import { startFilteringLog } from './filtering-log';
import { initializeExtension } from './init';
import { proxyHandler } from './messages';
import { logger, TS_WEB_EXTENSION } from './state';
import { isExampleMessage, isTsWebExtensionMessage } from './types';

export type { ConfigResponse } from './types';

declare global {
    interface Window {
        tsWebExtension: TsWebExtension;
    }
}

await TS_WEB_EXTENSION.initStorage();
self.tsWebExtension = TS_WEB_EXTENSION;

subscribeAssistantCreateRule();
startFilteringLog();

browser.runtime.onInstalled.addListener(async () => {
    await initializeExtension('install');
});

browser.runtime.onMessage.addListener((
    message: unknown,
    sender: browser.Runtime.MessageSender,
    sendResponse,
) => {
    if (isExampleMessage(message) || isTsWebExtensionMessage(message)) {
        proxyHandler(message, sender).then(sendResponse);
    } else {
        logger.error('[tswebexample.index]: received message with invalid type:', message);
    }

    return true;
});
