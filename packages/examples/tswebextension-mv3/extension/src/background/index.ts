import {
    TsWebExtension,
    Configuration,
    MessageType,
    MESSAGE_HANDLER_NAME,
    defaultFilteringLog,
    FilteringEventType,
    FilterListPreprocessor,
} from '@adguard/tswebextension/mv3';
import browser from 'webextension-polyfill';

import { Message } from '../message';
import { StorageKeys, storage } from './storage';
import { loadDefaultConfig } from './loadDefaultConfig';
import { EXTENSION_INITIALIZED_EVENT } from '../common/constants';
import { type FilteringLogEvent } from '@adguard/tswebextension';

declare global {
    interface Window {
        tsWebExtension: TsWebExtension;
    }
}

const tsWebExtension = new TsWebExtension('/web-accessible-resources/redirects');
await tsWebExtension.initStorage();

tsWebExtension.onAssistantCreateRule.subscribe((rule) => {
    console.log(`assistant create rule ${rule}`);
});
self.tsWebExtension = tsWebExtension;
const defaultUxConfig = {
    isStarted: true,
};
interface IMessage {
    type: Message;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data?: any;
}

interface IMessageInner {
    type: MessageType;
    handlerName: typeof MESSAGE_HANDLER_NAME;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    payload?: any;
}

export type ConfigResponse = {
    status: boolean;
    filters: number[];
    rules: string;
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
                rules: FilterListPreprocessor.getOriginalFilterListText({
                    rawFilterList: config.userrules.rawFilterList,
                    conversionMap: config.userrules.conversionMap,
                }),
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
            const preprocessed = FilterListPreprocessor.preprocess(data as string);

            config.userrules = {
                ...preprocessed,
                trusted: true,
            };

            await tsWebExtension.configure(config);

            await storage.set(StorageKeys.Config, config);

            break;
        }
        case Message.OpenAssistant: {
            const tabs = await browser.tabs.query({ active: true });
            if (tabs.length > 0 && tabs[0].id) {
                await tsWebExtension.openAssistant(tabs[0].id);
            }

            break;
        }
        case Message.CloseAssistant: {
            const tabs = await browser.tabs.query({ active: true });
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

    try {
        await tsWebExtension.initStorage();
    } catch (e) {
        // TODO: Investigate why we got "Storage is already initialized" error
        console.error('Failed to init storage', e);
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
    sender: browser.Runtime.MessageSender,
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

/**
 * Example of usage filtering log events.
 */
const startFilteringLog = async () => {
    const logEvent = (event: FilteringLogEvent) => {
        // Beautify declarative rule json.
        if (event.type === FilteringEventType.MatchedDeclarativeRule) {
            Object.assign(event.data.declarativeRuleInfo, {
                declarativeRuleJson: JSON.parse(event.data.declarativeRuleInfo.declarativeRuleJson),
            });
        }

        console.debug(`[${event.type}]: ${JSON.stringify(event.data, null, 2)}`);
    };

    defaultFilteringLog.addEventListener(FilteringEventType.SendRequest, logEvent);
    defaultFilteringLog.addEventListener(FilteringEventType.ReceiveResponse, logEvent);
    defaultFilteringLog.addEventListener(FilteringEventType.ApplyBasicRule, logEvent);
    defaultFilteringLog.addEventListener(FilteringEventType.ApplyCosmeticRule, logEvent);
    defaultFilteringLog.addEventListener(FilteringEventType.JsInject, logEvent);
    defaultFilteringLog.addEventListener(FilteringEventType.MatchedDeclarativeRule, logEvent);
};

/**
 * Checks if `message` is of type `IMessage`.
 *
 * @param message Message to check.
 * @returns True if `message` has defined `type` property so it can be considered as `IMessage`,
 * false otherwise.
 */
const isMessage = (message: unknown): message is IMessage => {
    return (message as IMessage).type !== undefined;
};

/**
 * Checks if `message` is of type `IMessageInner`.
 *
 * @param message Message to check.
 * @returns True if `message` has defined properties `handlerName` and `type`
 * so it can be considered as `IMessageInner`,
 * false otherwise.
 */
const isMessageInner = (message: unknown): message is IMessageInner => {
    return (message as IMessageInner).handlerName !== undefined
        || (message as IMessageInner).type !== undefined;
};

// TODO: Add same logic for update event
browser.runtime.onInstalled.addListener(async () => {
    console.debug('[ON INSTALLED]: start');

    await initExtension('install');

    await startFilteringLog();

    console.debug('[ON INSTALLED]: done');
});

browser.runtime.onMessage
    .addListener((
        message: unknown,
        sender: browser.Runtime.MessageSender,
        sendResponse,
    ) => {
        console.debug('browser.runtime.onMessage: ', message);

        if (isMessageInner(message) || isMessage(message)) {
            proxyHandler(message, sender).then(sendResponse);
        } else {
            console.error('Received message with invalid type:', message);
        }

        return true;
    });
