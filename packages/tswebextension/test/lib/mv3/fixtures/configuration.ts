import { ConvertedFilterList } from '@adguard/tsurlfilter';

import { LF } from '../../../../src/lib/common/constants';
import { type ConfigurationMV3 } from '../../../../src/lib/mv3/background/configuration';

export const getConfigurationMv3Fixture = (): ConfigurationMV3 => ({
    staticFiltersIds: [1, 2],
    customFilters: [],
    filtersPath: '',
    ruleSetsPath: '',
    allowlist: ['example.com'],
    userrules: { content: ['||example.org^', 'example.com##h1', 'baddomain.org$document'].join(LF) },
    quickFixesRules: {
        content: ['@@baddomain.org$document'].join(LF),
        trusted: true,
        conversionData: ConvertedFilterList.createEmptyConversionData(),
    },
    verbose: false,
    declarativeLogEnabled: false,
    settings: {
        filteringEnabled: true,
        stealthModeEnabled: true,
        collectStats: true,
        debugScriptlets: false,
        allowlistInverted: false,
        allowlistEnabled: false,
        documentBlockingPageUrl: 'https://example.org',
        assistantUrl: '/assistant-inject.js',
        gpcScriptUrl: '/gpc.js',
        hideDocumentReferrerScriptUrl: '/hide-document-referrer.js',
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
    trustedDomains: [],
});
