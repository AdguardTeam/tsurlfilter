import browser, { Events } from 'webextension-polyfill';
import {
    type ConfigurationMV2,
    ConvertedFilterList,
    MESSAGE_HANDLER_NAME,
    createTsWebExtension,
} from '@adguard/tswebextension';

import { MessageTypes } from '../common/message-types';
import { BuildOutput } from '../../../constants';

const tsWebExtension = createTsWebExtension('war');

/*
 * Need for access tsWebExtension instance form browser auto test tool
 */
declare global {
    interface Window {
        tsWebExtension: typeof tsWebExtension;
    }
}

window.tsWebExtension = tsWebExtension;

const rawUserRules = [
    'example.com##h1',
];

// simple in-memory storage for user rules and allowlist
let userrules = new ConvertedFilterList(rawUserRules.join('\n'));
let allowlist: string[] = [];

const defaultConfig: ConfigurationMV2 = {
    filters: [],
    allowlist,
    trustedDomains: [],
    userrules: {
        content: userrules.getContent(),
        conversionData: userrules.getConversionData(),
    },
    verbose: false,
    settings: {
        assistantUrl: `${BuildOutput.AssistantInject}.js`,
        filteringEnabled: true,
        stealthModeEnabled: true,
        collectStats: true,
        debugScriptlets: false,
        allowlistInverted: false,
        allowlistEnabled: true,
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

tsWebExtension.initStorage();

tsWebExtension.start(defaultConfig);

tsWebExtension.onFilteringLogEvent.subscribe(console.log);

tsWebExtension.onAssistantCreateRule.subscribe((rule) => console.log(`assistant create rule ${rule}`));

const tsWebExtensionMessageHandler = tsWebExtension.getMessageHandler();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(browser.runtime.onMessage as Events.Event<(...args: any[]) => void>).addListener((message, sender, sendResponse) => {

    if (message.handlerName === MESSAGE_HANDLER_NAME) {
        return tsWebExtensionMessageHandler(message, sender);
    }

    switch (message.type) {
        // change user rules and allowlist
        case MessageTypes.GET_CONFIG: {
            sendResponse({
                type: MessageTypes.GET_CONFIG_SUCCESS,
                payload: {
                    allowlist,
                    userrules: userrules.getOriginalContent(),
                },
            });
            break;
        }
        // get current user rules and allowlist
        case MessageTypes.SET_CONFIG: {
            userrules = new ConvertedFilterList(message.payload.userrules);
            allowlist = message.payload.allowlist;
            const config = {
                ...defaultConfig,
                userrules: {
                    content: userrules.getContent(),
                    conversionData: userrules.getConversionData(),
                },
                allowlist,
            };
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
