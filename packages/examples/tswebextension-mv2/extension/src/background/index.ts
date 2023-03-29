import browser, { Events } from 'webextension-polyfill';
import { TsWebExtension, ConfigurationMV2, MESSAGE_HANDLER_NAME } from '@adguard/tswebextension';

import { MessageTypes } from '../common/message-types';
import { BuildOutput } from '../../../constants';

const tsWebExtension = new TsWebExtension('war');

/*
 * Need for access tsWebExtension instance form browser auto test tool
 */

declare global {
    interface Window {
        tsWebExtension: TsWebExtension;
    }
}

window.tsWebExtension = tsWebExtension;

const defaultConfig: ConfigurationMV2 = {
    filters: [],
    allowlist: [],
    trustedDomains: [],
    userrules: [],
    verbose: false,
    settings: {
        assistantUrl: `${BuildOutput.AssistantInject}.js`,
        filteringEnabled: true,
        stealthModeEnabled: true,
        collectStats: true,
        allowlistInverted: false,
        allowlistEnabled: false,
        documentBlockingPageUrl: browser.runtime.getURL('pages/document-blocking.html'),
        stealth: {
            blockChromeClientData: false,
            hideReferrer: false,
            hideSearchQueries: false,
            sendDoNotTrack: false,
            blockWebRTC: false,
            selfDestructThirdPartyCookies: true,
            selfDestructThirdPartyCookiesTime: 3600,
            selfDestructFirstPartyCookies: true,
            selfDestructFirstPartyCookiesTime: 3600,
        },
    },
};

tsWebExtension.start(defaultConfig);

tsWebExtension.onFilteringLogEvent.subscribe(console.log);

tsWebExtension.onAssistantCreateRule.subscribe((rule) => console.log(`assistant create rule ${rule}`));

const tsWebExtensionMessageHandler = tsWebExtension.getMessageHandler();

(browser.runtime.onMessage as Events.Event<(...args: any[]) => void>).addListener((message, sender, sendResponse) => {
    if (message.handlerName === MESSAGE_HANDLER_NAME) {
        return tsWebExtensionMessageHandler(message, sender);
    }

    switch (message.type) {
        case MessageTypes.GET_CONFIG: {
            const config = tsWebExtension.configuration;
            sendResponse({ type: MessageTypes.GET_CONFIG_SUCCESS, payload: config });
            break;
        }
        case MessageTypes.SET_CONFIG: {
            const config = { ...defaultConfig, ...message.payload };
            tsWebExtension.configure(config).then(() => {
                alert('loaded');
                sendResponse({ type: MessageTypes.GET_CONFIG_SUCCESS, payload: config });
            });
            break;
        }
        case MessageTypes.OPEN_ASSISTANT: {
            chrome.tabs.query({ active: true }, (res) => {
                if (res.length > 0 && res[0].id) {
                    tsWebExtension.openAssistant(res[0].id);
                }
            });
            break;
        }
        case MessageTypes.CLOSE_ASSISTANT: {
            chrome.tabs.query({ active: true }, (res) => {
                if (res.length > 0 && res[0].id) {
                    tsWebExtension.closeAssistant(res[0].id);
                }
            });
            break;
        }
        default:
            // do nothing
    }
});
