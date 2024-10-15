import { 
    type Configuration,
    type TsWebExtension,
} from '@adguard/tswebextension/mv3';
import {
    FilterListPreprocessor,
    PreprocessedFilterList,
} from '@adguard/tsurlfilter';
import { LogLevel } from '@adguard/logger';
import { FILTERS_PATH, RULESETS_PATH, STATIC_FILTER_IDS } from './constants';

export const DEFAULT_EXTENSION_CONFIG: Omit<Configuration, 'loadFilterContent'> = {
    staticFiltersIds: STATIC_FILTER_IDS,
    logLevel: LogLevel.Debug,
    customFilters: [],
    allowlist: [],
    userrules: Object.assign(
        FilterListPreprocessor.createEmptyPreprocessedFilterList(),
        { trusted: true },
    ),
    quickFixesRules: Object.assign(
        FilterListPreprocessor.createEmptyPreprocessedFilterList(),
        { trusted: true },
    ),
    verbose: true,
    filtersPath: FILTERS_PATH,
    ruleSetsPath: RULESETS_PATH,
    declarativeLogEnabled: true,
    settings: {
        assistantUrl: 'assistant-inject.js',
        gpcScriptUrl: 'gpc.js',
        hideDocumentReferrerScriptUrl: 'hide-document-referrer.js',
        collectStats: true,
        allowlistEnabled: true,
        allowlistInverted: false,
        stealthModeEnabled: true,
        filteringEnabled: true,
        debugScriptlets: true,
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

/**
 * Extends the base configuration with filter content loading method.
 *
 * @param baseConfigToExtend The base configuration object, excluding the `loadFilterContent` property.
 * @param tsWebExtensionClass An instance of the `TsWebExtension` class.
 *
 * @returns The extended configuration object.
 */
export const extendConfigurationWithLoader = (
    baseConfigToExtend: Omit<Configuration, 'loadFilterContent'>,
    tsWebExtensionClass: typeof TsWebExtension,
): Configuration => {
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
    const loadFilterContent = async (filterId: number): Promise<PreprocessedFilterList> => {
        console.debug(`[LOAD FILTER CONTENT] filterId: ${filterId}`);

        // TODO: Add some more efficient way to load filter content
        return tsWebExtensionClass.getPreprocessedFilterList(filterId, baseConfigToExtend.ruleSetsPath);
    };

    return Object.assign(baseConfigToExtend, { loadFilterContent });
};
