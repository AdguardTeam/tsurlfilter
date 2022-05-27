import { Configuration } from '@adguard/tswebextension/mv3';
import { loadFilterContent } from './loadFilterContent';

/**
 * Return default configuration with loaded filters content
 * @param filtersDir directory with filters in txt format
 * @returns configuration
 */
export const loadDefaultConfig = async (filtersDir: string): Promise<Configuration> => {
    console.debug('[LOAD DEFAULT CONFIG]: start');

    const defaultFilters = [1, 2, 3, 4, 9, 14];
    const defaultConfig: Configuration = {
        filters: [],
        allowlist: [],
        userrules: [],
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
    };

    defaultConfig.filters = await Promise.all(
        defaultFilters.map((id) => loadFilterContent(id, filtersDir)),
    );

    console.debug('[LOAD DEFAULT CONFIG]: end');

    return defaultConfig;
};
