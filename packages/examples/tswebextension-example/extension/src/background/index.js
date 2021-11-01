import { TsWebExtension } from "@adguard/tswebextension";


const tsWebExtension = new TsWebExtension();

tsWebExtension.start({
    filters: [
        { filterId: 1, content: '' },
        { filterId: 2, content: '' },
    ],
    allowlist: ['example.com'],
    userrules: ['example.org##h1', 'example.com##h1'],
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
});