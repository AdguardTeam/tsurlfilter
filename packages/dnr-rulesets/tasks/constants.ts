
const FILTERS_SERVER_URL = 'https://filters.adtidy.org/extension/chromium-mv3';

export const BASE_DIR = './dist';
export const COMMON_FILTERS_DIR = `${BASE_DIR}/filters`;
export const FILTERS_DIR = `${COMMON_FILTERS_DIR}`;
export const DEST_RULE_SETS_DIR = `${COMMON_FILTERS_DIR}/declarative`;
export const RESOURCES_DIR = '/war/redirects';
export const FILTERS_URL = `${FILTERS_SERVER_URL}/filters`;
export const FILTERS_METADATA_URL = `${FILTERS_SERVER_URL}/filters.json`;
export const README_PATH = './README.md';