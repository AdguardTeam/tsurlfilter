import { TsWebExtension } from "@adguard/tswebextension";

const tsWebExtension = new TsWebExtension();

const defaultConfig = {
    filters: [],
    allowlist: ['example.com'],
    userrules: [
        'example.org##h1',
        `example.org#%#alert('hi');`,
        `example.org#%#//scriptlet('log', 'arg1', 'arg2')`,
        'example.org#?#a:contains(More information...)',
        '||meduza.io^$script,redirect=noopjs',
        'example.com##h1'
    ],
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
    const { type, payload } = JSON.parse(message);

    switch (type) {
        case 'GET_CONFIG': {
            const config = tsWebExtension.configuration;
            sendResponce({ type: 'GET_CONFIG_SUCCESS', payload: config });
            break;
        }  
        case 'SET_CONFIG': {
            const config = { ...defaultConfig, ...payload }
            tsWebExtension.configure(config);
            sendResponce({ type: 'SET_CONFIG_SUCCESS', payload: config })
            break;
        }
        default:
            // do nothing
    }
});