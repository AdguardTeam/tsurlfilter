import { TsWebExtension } from "@adguard/tswebextension";


const tsWebExtension = new TsWebExtension();

tsWebExtension.initMessageHandler();

tsWebExtension.start({
    filters: [
        { filterId: 1, content: 'example.org##h1\nexample.org#%#console.log(1);' },
        { filterId: 2, content: '' },
    ],
    allowlist: ['example.com'],
    userrules: [
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
});