import { type Configuration } from '@adguard/tswebextension/mv3';
import { DEFAULT_EXTENSION_CONFIG } from '../../../scripts/constants';

/**
 * Return default configuration with loaded filters content
 * @param filtersDir directory with filters in txt format
 * @returns configuration
 */
export const loadDefaultConfig = (): Configuration => {
    console.debug('[LOAD DEFAULT CONFIG]');

    return DEFAULT_EXTENSION_CONFIG;
};
