import { Configuration } from '@adguard/tswebextension/mv3';

/**
 * Return default configuration with loaded filters content
 * @param filtersDir directory with filters in txt format
 * @returns configuration
 */
export const loadDefaultConfig = (): Configuration => {
    console.debug('[LOAD DEFAULT CONFIG]: start');

    const defaultConfig: Configuration = {
        staticFiltersIds: [1, 2, 3, 4, 9, 14],
        customFilters: [],
        allowlist: [],
        trustedDomains: [],
        userrules: [],
        verbose: false,
        filtersPath: 'filters',
        ruleSetsPath: 'filters/declarative',
        filteringLogEnabled: false,
        settings: {
            assistantUrl: '',
            collectStats: true,
            allowlistInverted: false,
            allowlistEnabled: false,
            documentBlockingPageUrl: chrome.runtime.getURL('pages/document-blocking.html'),
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

    console.debug('[LOAD DEFAULT CONFIG]: end');

    return defaultConfig;
};
