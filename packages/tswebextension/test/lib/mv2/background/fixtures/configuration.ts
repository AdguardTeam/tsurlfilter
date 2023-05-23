import { ConfigurationMV2 } from '@lib/mv2/background/configuration';

export const getConfigurationMv2Fixture = (): ConfigurationMV2 => ({
    filters: [
        { filterId: 1, content: '', trusted: true },
        { filterId: 2, content: '', trusted: true },
    ],
    allowlist: ['example.com'],
    trustedDomains: [],
    userrules: ['||example.org^', 'example.com##h1'],
    verbose: false,
    settings: {
        filteringEnabled: true,
        stealthModeEnabled: true,
        collectStats: true,
        allowlistInverted: false,
        allowlistEnabled: false,
        documentBlockingPageUrl: 'https://example.org',
        assistantUrl: '/assistant-inject.js',
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
