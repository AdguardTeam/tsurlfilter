import { type ConfigurationMV2, LF } from '../../../../../src/lib';

const { FilterListPreprocessor } = jest.requireActual('@adguard/tsurlfilter');

export const getConfigurationMv2Fixture = (): ConfigurationMV2 => ({
    filters: [
        { filterId: 1, content: FilterListPreprocessor.preprocess('').filterList, trusted: true },
        { filterId: 2, content: FilterListPreprocessor.preprocess('').filterList, trusted: true },
    ],
    allowlist: ['example.com'],
    trustedDomains: [],
    userrules: {
        content: FilterListPreprocessor.preprocess(
            ['||example.org^', 'example.com##h1'].join(LF),
        ).filterList,
    },
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
