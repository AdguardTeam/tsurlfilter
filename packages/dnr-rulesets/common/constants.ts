/**
 * List of browsers for which DNR rulesets are built.
 */
export enum BrowserFilters {
    ChromiumMv3 = 'chromium-mv3',
    OperaMv3 = 'opera-mv3',
}

/**
 * Placeholder string for browser name which will be replaced
 * with actual browser name during build process.
 */
export const FILTERS_BROWSER_PLACEHOLDER = '%browser%';

/**
 * Base URL for filters location.
 */
const FILTERS_SERVER_URL = `https://filters.adtidy.org/extension/${FILTERS_BROWSER_PLACEHOLDER}`;

/**
 * Base directory for build output.
 */
export const BASE_DIR = './dist';

/**
 * Base directory for filters of the browser.
 */
export const COMMON_FILTERS_DIR = `${BASE_DIR}/filters/${FILTERS_BROWSER_PLACEHOLDER}`;

/**
 * Output directory for filters of the browser.
 */
export const FILTERS_DIR = COMMON_FILTERS_DIR;

/**
 * Output directory for declarative rulesets of the browser.
 */
export const DEST_RULESETS_DIR = `${COMMON_FILTERS_DIR}/declarative`;

/**
 * Web-accessible resources directory for redirects.
 */
export const RESOURCES_DIR = '/web-accessible-resources/redirects';

/**
 * All filters URL for the browser.
 *
 * IMPORTANT: Replace {@link FILTERS_BROWSER_PLACEHOLDER} with actual browser name!
 */
export const FILTERS_URL = `${FILTERS_SERVER_URL}/filters`;

/**
 * Remote metadata file name for filters.
 *
 * IMPORTANT: extensions '.js' used for correct work of Cloudflare cache,
 * but real format of these files is JSON. See AG-1901 for details.
 */
export const REMOTE_METADATA_FILE_NAME = 'filters.js';

/**
 * Remote i18n metadata file name for filters.
 *
 * IMPORTANT: extensions '.js' used for correct work of Cloudflare cache,
 * but real format of these files is JSON. See AG-1901 for details.
 */
export const REMOTE_I18N_METADATA_FILE_NAME = 'filters_i18n.js';

/**
 * Local metadata file name for filters.
 *
 * IMPORTANT: But locally we prefer to use '.json' extension. See AG-1901 for details.
 */
export const LOCAL_METADATA_FILE_NAME = 'filters.json';

/**
 * Local i18n metadata file name for filters.
 *
 * IMPORTANT: But locally we prefer to use '.json' extension. See AG-1901 for details.
 */
export const LOCAL_I18N_METADATA_FILE_NAME = 'filters_i18n.json';

/**
 * URL for remote metadata file for filters.
 */
export const FILTERS_METADATA_URL = `${FILTERS_SERVER_URL}/${REMOTE_METADATA_FILE_NAME}`;

/**
 * URL for remote i18n metadata file for filters.
 */
export const FILTERS_METADATA_I18N_URL = `${FILTERS_SERVER_URL}/${REMOTE_I18N_METADATA_FILE_NAME}`;

/**
 * Filters list file path.
 */
export const FILTERS_MARKDOWN_PATH = './FILTERS.md';
