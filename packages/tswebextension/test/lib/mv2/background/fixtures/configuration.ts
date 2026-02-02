import { type ConfigurationMV2 } from '../../../../../src/lib/mv2/background/configuration';
import { LF } from '../../../../../src/lib/common/constants';

export const getConfigurationMv2Fixture = (): ConfigurationMV2 => ({
    filters: [
        { filterId: 1, content: '', trusted: true },
        { filterId: 2, content: '', trusted: true },
    ],
    allowlist: ['example.com'],
    trustedDomains: [],
    userrules: { content: ['||example.org^', 'example.com##h1'].join(LF) },
    verbose: false,
    settings: {
        filteringEnabled: true,
        stealthModeEnabled: true,
        collectStats: true,
        debugScriptlets: false,
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
