import browser from 'webextension-polyfill';

import { FilterList, USER_FILTER_ID } from '@adguard/tswebextension/mv3';

import { Message } from '../message';

import { initializeExtension } from './init';
import { appState, logger, TS_WEB_EXTENSION } from './state';
import { storage, StorageKeys } from './storage';
import { type ConfigResponse, type ExampleMessage, isTsWebExtensionMessage, type MessageLike } from './types';

/**
 * Dispatched by the popup / content script to the background.
 */
export const handleExampleMessage = async (message: ExampleMessage) => {
    const { type, data } = message;

    switch (type) {
        case Message.GetConfig: {
            const cfg = appState.config!;
            const res: ConfigResponse = {
                status: appState.isStarted || false,
                filters: cfg.staticFiltersIds,
                rules: new FilterList(
                    cfg.userrules.content,
                    USER_FILTER_ID,
                    cfg.userrules.conversionData,
                ).getOriginalContent(),
            };
            return res;
        }

        case Message.UpdateFilters: {
            appState.config!.staticFiltersIds = data as number[];
            await TS_WEB_EXTENSION.configure(appState.config!);
            await storage.set(StorageKeys.Config, appState.config);
            break;
        }

        case Message.TurnOff: {
            try {
                await TS_WEB_EXTENSION.stop();
                appState.isStarted = false;
            } catch (e) {
                logger.error('[tswebexample.messages]: stop failed:', (e as Error).message);
            }
            await storage.set(StorageKeys.IsStarted, appState.isStarted);
            return appState.isStarted;
        }

        case Message.TurnOn: {
            try {
                await TS_WEB_EXTENSION.start(appState.config!);
                appState.isStarted = true;
            } catch (e) {
                logger.error('[tswebexample.messages]: start failed:', (e as Error).message);
            }
            await storage.set(StorageKeys.IsStarted, appState.isStarted);
            return appState.isStarted;
        }

        case Message.ApplyUserRules: {
            const list = new FilterList(data);
            appState.config!.userrules = {
                content: list.getContent(),
                conversionData: list.getConversionData(),
            };
            await TS_WEB_EXTENSION.configure(appState.config!);
            await storage.set(StorageKeys.Config, appState.config);
            break;
        }

        case Message.OpenAssistant: {
            const tabs = await browser.tabs.query({ active: true });
            if (tabs.length > 0 && tabs[0].id) {
                await TS_WEB_EXTENSION.openAssistant(tabs[0].id);
            }
            break;
        }

        case Message.CloseAssistant: {
            const tabs = await browser.tabs.query({ active: true });
            if (tabs.length > 0 && tabs[0].id) {
                await TS_WEB_EXTENSION.closeAssistant(tabs[0].id);
            }
            break;
        }
    }
};

const tsWebExtensionMessageHandler = TS_WEB_EXTENSION.getMessageHandler();

export const proxyHandler = async (
    message: MessageLike,
    sender: browser.Runtime.MessageSender,
) => {
    await initializeExtension();

    if (isTsWebExtensionMessage(message)) {
        return tsWebExtensionMessageHandler(message, sender);
    }

    return handleExampleMessage(message as ExampleMessage);
};
