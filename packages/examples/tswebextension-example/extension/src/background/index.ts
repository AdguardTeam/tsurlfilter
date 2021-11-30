import { TsWebExtension, Configuration } from "@adguard/tswebextension";

import { MessageTypes } from "../common/message-types";

const tsWebExtension = new TsWebExtension();

/*
 * Need for access tsWebExtension instance form browser autotest tool
 */

declare global {
    interface Window {
        tsWebExtension: TsWebExtension;
    }
}

window.tsWebExtension = tsWebExtension;

const defaultConfig: Configuration = {
    filters: [],
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
}

tsWebExtension.start(defaultConfig);

chrome.runtime.onMessage.addListener((message, _sender, sendResponce) => {
    switch (message.type) {
        case MessageTypes.GET_CONFIG: {
            const config = tsWebExtension.configuration;
            sendResponce({ type: MessageTypes.GET_CONFIG_SUCCESS, payload: config });
            break;
        }  
        case MessageTypes.SET_CONFIG: {
            const config = { ...defaultConfig, ...message.payload }
            tsWebExtension.configure(config).then(() => {
                alert('loaded')
                sendResponce({ type: MessageTypes.GET_CONFIG_SUCCESS, payload: config })
            });
            break;
        }
        default:
            // do nothing
    }
});