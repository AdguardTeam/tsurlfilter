import {
    TsWebExtension,
    Configuration,
    CommonMessageType,
} from '@adguard/tswebextension/mv3';
import { MESSAGE_HANDLER_NAME } from '@adguard/tswebextension';
import { Message } from '../message';
import { StorageKeys, storage } from './storage';
import { loadDefaultConfig } from './loadDefaultConfig';
import { EXTENSION_INITIALIZED_EVENT } from '../common/constants';

declare global {
    interface Window {
        tsWebExtension: TsWebExtension;
    }
}

const tsWebExtension = new TsWebExtension('/war/redirects');
tsWebExtension.onAssistantCreateRule.subscribe((rule) => {
    console.log(`assistant create rule ${rule}`);
});
self.tsWebExtension = tsWebExtension;
const defaultUxConfig = {
    isStarted: true,
};
interface IMessage {
    type: Message,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data?: any,
}

interface IMessageInner {
    type: CommonMessageType,
    handlerName: typeof MESSAGE_HANDLER_NAME,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    payload?: any,
}

export type ConfigResponse = {
    status: boolean,
    filters: number[],
    rules: string[],
};

let config: Configuration;

let isInitialized = false;
let isStarted: boolean | undefined;
let initializingPromise: Promise<void> | undefined;

const tsWebExtensionMessageHandler = tsWebExtension.getMessageHandler();

const messageHandler = async (message: IMessage) => {
    const { type, data } = message;
    switch (type) {
        case Message.GetConfig: {
            const res: ConfigResponse = {
                status: isStarted || false,
                filters: config.staticFiltersIds,
                rules: config.userrules,
            };

            return res;
        }
        case Message.UpdateFilters: {
            const filterIds = data as number[];

            config.staticFiltersIds = filterIds;

            await tsWebExtension.configure(config);

            await storage.set(StorageKeys.Config, config);

            break;
        }
        case Message.TurnOff: {
            try {
                await tsWebExtension.stop();
                isStarted = false;
            } catch (e) {
                console.log((e as Error).message);
            }

            await storage.set(StorageKeys.IsStarted, isStarted);

            return isStarted;
        }
        case Message.TurnOn: {
            try {
                await tsWebExtension.start(config);
                isStarted = true;
            } catch (e) {
                console.log((e as Error).message);
            }

            await storage.set(StorageKeys.IsStarted, isStarted);

            return isStarted;
        }
        case Message.ApplyUserRules: {
            config.userrules = (data as string).split('\n');

            await tsWebExtension.configure(config);

            await storage.set(StorageKeys.Config, config);

            break;
        }
        case Message.StartLog: {
            config.filteringLogEnabled = true;

            await tsWebExtension.configure(config);

            break;
        }
        case Message.StopLog: {
            config.filteringLogEnabled = false;

            await tsWebExtension.configure(config);

            break;
        }
        case Message.OpenAssistant: {
            const tabs = await chrome.tabs.query({ active: true });
            if (tabs.length > 0 && tabs[0].id) {
                await tsWebExtension.openAssistant(tabs[0].id);
            }

            break;
        }
        case Message.CloseAssistant: {
            const tabs = await chrome.tabs.query({ active: true });
            if (tabs.length > 0 && tabs[0].id) {
                await tsWebExtension.closeAssistant(tabs[0].id);
            }

            break;
        }
    }
};

const startIfNeed = async () => {
    if (isStarted === undefined) {
        const savedValue = await storage.get<boolean>(StorageKeys.IsStarted);

        if (savedValue !== undefined) {
            isStarted = savedValue;
        } else {
            isStarted = defaultUxConfig.isStarted;
            await storage.set(StorageKeys.IsStarted, isStarted);
        }
    }

    if (isStarted) {
        await tsWebExtension.start(config);
    }
};

const waitForInitAndClean = async () => {
    await initializingPromise;
    initializingPromise = undefined;

    isInitialized = true;
    dispatchEvent(new Event(EXTENSION_INITIALIZED_EVENT));
};

const checkConfigAndStart = async () => {
    if (config === undefined) {
        const savedConfig = await storage.get<Configuration>(StorageKeys.Config);
        if (savedConfig) {
            config = savedConfig;
        } else {
            config = loadDefaultConfig();
            await storage.set(StorageKeys.Config, config);
        }
    }
};

const initExtension = async (messageId: string) => {
    await checkConfigAndStart();

    if (initializingPromise) {
        console.debug('[messageHandlerWrapper]: waiting for init', messageId);
        await waitForInitAndClean();
    }

    if (!isInitialized) {
        console.debug('[messageHandlerWrapper]: start init', messageId);
        initializingPromise = startIfNeed();
        await waitForInitAndClean();
    }
};

const proxyHandler = async (
    message: IMessage | IMessageInner,
    sender: chrome.runtime.MessageSender,
) => {
    const id = 'id_' + Math.random().toString(16).slice(2);
    console.debug('[PROXY HANDLER]: start check config', id, message);

    await initExtension(id);

    console.debug('[PROXY HANDLER]: after check config ', id, message);

    if ((message as IMessageInner)?.handlerName === 'tsWebExtension') {
        return tsWebExtensionMessageHandler(message as IMessageInner, sender);
    } else {
        return messageHandler(message as IMessage);
    }
};

// TODO: Add same logic for update event
chrome.runtime.onInstalled.addListener(async () => {
    console.debug('[ON INSTALLED]: start');

    await initExtension('install');

    console.debug('[ON INSTALLED]: done');
});

chrome.runtime.onMessage
    .addListener((
        message: IMessage | IMessageInner,
        sender: chrome.runtime.MessageSender,
        sendResponse,
    ) => {
        console.debug('chrome.runtime.onMessage: ', message);

        proxyHandler(message, sender).then(sendResponse);

        return true;
    });
