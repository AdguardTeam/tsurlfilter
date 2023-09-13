import { Configuration } from '@adguard/tswebextension/mv3';

// TODO: can be used as common for examples/tswebextension-mv2 as well
export const TESTCASES_BASE_URL = 'https://testcases.agrd.dev';

export const TESTCASES_DATA_PATH = '/data.json';

export const DEFAULT_EXTENSION_CONFIG: Configuration = {
    staticFiltersIds: [1, 2, 3, 4, 9, 14],
    customFilters: [],
    allowlist: [],
    userrules: [],
    trustedDomains: [],
    verbose: false,
    filtersPath: 'filters',
    ruleSetsPath: 'filters/declarative',
    filteringLogEnabled: false,
    settings: {
        assistantUrl: '',
        collectStats: true,
        allowlistEnabled: true,
        allowlistInverted: false,
        stealthModeEnabled: true,
        filteringEnabled: true,
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
