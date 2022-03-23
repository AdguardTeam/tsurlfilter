import { TsWebExtensionMv3, ConfigurationMV3 } from '@adguard/tswebextension/mv3';
import { Message } from '../message';

const tsWebExtension = new TsWebExtensionMv3(undefined);

const defaultConfig: ConfigurationMV3 = {
    filters: [ 1, 2, 3, 4, 9, 14 ],
    allowlist: [],
    userrules: [],
    verbose: false,
    settings: {
        collectStats: true,
        allowlistInverted: false,
        stealth: {
            blockChromeClientData: true,
            hideReferrer: true,
            hideSearchQueries: true,
            sendDoNotTrack: true,
            blockWebRTC: true,
            selfDestructThirdPartyCookies: true,
            selfDestructThirdPartyCookiesTime: 3600,
            selfDestructFirstPartyCookies: true,
            selfDestructFirstPartyCookiesTime: 3600,
        },
    },
};


chrome.runtime.onInstalled.addListener(async () => {
    console.log('onInstalled: start filtering');
    await tsWebExtension.start(defaultConfig);
    await chrome.storage.local.set({
        'config': defaultConfig,
    });
});

interface IMessage {
    type: Message,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data?: any,
}

const messageHandler = async (
    message: IMessage,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sendResponse: (response?: any) => void,
) => {
    console.log('chrome.runtime.onMessage: ', message);
    const { type, data } = message;

    const { config } = await chrome.storage.local.get('config') || { config: defaultConfig };

    switch (type) {
        case Message.GET_CONFIG: {
            sendResponse({
                status: tsWebExtension.isStarted,
                filters: tsWebExtension.configuration?.filters,
                rules: tsWebExtension.configuration?.userrules,
            });

            break;
        }
        case Message.UPDATE_FILTERS: {
            config.filters = data as number[];
            await tsWebExtension.configure(config);
            await chrome.storage.local.set({ config });

            sendResponse();

            break;
        }
        case Message.TURN_OFF: {
            await tsWebExtension.stop();

            sendResponse(tsWebExtension.isStarted);

            break;
        }
        case Message.TURN_ON: {
            await tsWebExtension.start(tsWebExtension.configuration || config);

            sendResponse(tsWebExtension.isStarted);

            break;
        }
        case Message.APPLY_USER_RULES: {
            config.userrules = (data as string).split('\n');
            await tsWebExtension.configure(config);
            await chrome.storage.local.set({ config });

            sendResponse();

            break;
        }
    }
};

chrome.runtime.onMessage.addListener((message: IMessage, sender, sendResponse) => {
    messageHandler(message, sendResponse);

    return true;
});
