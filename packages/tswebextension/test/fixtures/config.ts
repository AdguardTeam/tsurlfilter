import { Configuration } from '@lib/common/configuration';

export const getConfigFixture = (): Configuration => ({
    allowlist: [],
    trustedDomains: [],
    userrules: [],
    verbose: false,
    settings: {
        filteringEnabled: true,
        stealthModeEnabled: true,
        collectStats: true,
        allowlistInverted: false,
        allowlistEnabled: true,
        assistantUrl: '',
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
});
