import { TsWebExtensionMv3, ConfigurationMV3 } from '@adguard/tswebextension/mv3';

const tsWebExtension = new TsWebExtensionMv3(undefined);

const config: ConfigurationMV3 = {
    filters: [ 0 ],
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
    console.log('start filtering for 5 seconds');
    await tsWebExtension.start(config);

    setTimeout(async () => {
        config.filters = [];
        await tsWebExtension.configure(config);
        console.log('all filters stopped');
    }, 5000);
});
