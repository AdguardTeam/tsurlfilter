const FILTERS_SERVER_URL = 'https://filters.adtidy.org/extension/chromium-mv3';

export const BASE_DIR = './dist';
export const COMMON_FILTERS_DIR = `${BASE_DIR}/filters`;
export const FILTERS_DIR = COMMON_FILTERS_DIR;
export const DEST_RULESETS_DIR = `${COMMON_FILTERS_DIR}/declarative`;
export const RESOURCES_DIR = '/web-accessible-resources/redirects';
export const FILTERS_URL = `${FILTERS_SERVER_URL}/filters`;

// IMPORTANT: extensions '.js' used for correct work of Cloudflare cache, but
// real format of these files is JSON.
// See AG-1901 for details.
export const REMOTE_METADATA_FILE_NAME = 'filters.js';
export const REMOTE_I18N_METADATA_FILE_NAME = 'filters_i18n.js';
// But locally we prefer to use '.json' extension.
export const LOCAL_METADATA_FILE_NAME = 'filters.json';
export const LOCAL_I18N_METADATA_FILE_NAME = 'filters_i18n.json';

export const FILTERS_METADATA_URL = `${FILTERS_SERVER_URL}/${REMOTE_METADATA_FILE_NAME}`;
export const FILTERS_METADATA_I18N_URL = `${FILTERS_SERVER_URL}/${REMOTE_I18N_METADATA_FILE_NAME}`;
export const README_PATH = './README.md';
export const QUICK_FIXES_FILTER_ID = 24;
