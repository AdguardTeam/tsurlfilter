import { FilterListPreprocessor, type PreprocessedFilterList } from '@adguard/tsurlfilter';
import { LF } from '../../../../src/lib/common/constants';
import { type ConfigurationMV3 } from '../../../../src/lib/mv3/background/configuration';

const preprocessedUserRules = FilterListPreprocessor.preprocess(
    ['||example.org^', 'example.com##h1', 'baddomain.org$document'].join(LF),
);

const preprocessedQuickFixes = FilterListPreprocessor.preprocess(
    ['@@baddomain.org$document'].join(LF),
);

/**
 * Loads filter content by filter id.
 *
 * @param filterId Filter identifier to load content for.
 *
 * @returns Promise that resolves to the filter content (see {@link PreprocessedFilterList})
 * or null if the filter is not found.
 *
 * @throws Error if the filter content cannot be loaded.
 */
// NOTE: We are not implementing this function in this fixture, because it is not yet used in the tests.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const loadFilterContent = async (filterId: number): Promise<PreprocessedFilterList> => {
    throw new Error('Not implemented');
};

export const getConfigurationMv3Fixture = (): ConfigurationMV3 => ({
    staticFiltersIds: [1, 2],
    customFilters: [],
    filtersPath: '',
    ruleSetsPath: '',
    allowlist: ['example.com'],
    userrules: {
        ...preprocessedUserRules,
        trusted: true,
    },
    quickFixesRules: {
        ...preprocessedQuickFixes,
        trusted: true,
    },
    verbose: false,
    declarativeLogEnabled: false,
    loadFilterContent,
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
});
