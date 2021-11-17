import { TsWebExtension } from "@adguard/tswebextension";

const tsWebExtension = new TsWebExtension();

window.tsWebExtension = tsWebExtension;

const defaultConfig = {
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
        case 'GET_CONFIG': {
            const config = tsWebExtension.configuration;
            sendResponce({ type: 'GET_CONFIG_SUCCESS', payload: config });
            break;
        }  
        case 'SET_CONFIG': {
            const config = { ...defaultConfig, ...message.payload }
            tsWebExtension.configure(config).then(() => {
                alert('loaded')
                sendResponce({ type: 'SET_CONFIG_SUCCESS', payload: config })
            });
            break;
        }
        default:
            // do nothing
    }
});