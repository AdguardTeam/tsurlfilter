import fs from 'fs';
import { convertFilters } from '@adguard/tsurlfilter/cli';
import { getFilterName } from '@adguard/tswebextension/mv3/utils';
import axios from 'axios';
import path from 'path';
import { ensureDir } from 'fs-extra';
import { DEFAULT_EXTENSION_CONFIG } from './constants';

const COMMON_FILTERS_DIR = './extension/filters';
const FILTERS_DIR = `${COMMON_FILTERS_DIR}`;
const DEST_RULE_SETS_DIR = `${COMMON_FILTERS_DIR}/declarative`;
const RESOURCES_DIR = '/war/redirects';

const ADGUARD_FILTERS_IDS = DEFAULT_EXTENSION_CONFIG.staticFiltersIds;

const EXTENSION_FILTERS_SERVER_URL_FORMAT = 'https://filters.adtidy.org/extension/chromium';
const FILTER_DOWNLOAD_URL_FORMAT = `${EXTENSION_FILTERS_SERVER_URL_FORMAT}/filters/%filter.txt`;

export type UrlType = {
    id: number,
    url: string,
    file: string,
};

const getUrlsOfFiltersResources = () => {
    return ADGUARD_FILTERS_IDS.map(filterId => ({
        id: filterId,
        url: FILTER_DOWNLOAD_URL_FORMAT.replace('%filter', `${filterId}`),
        file: getFilterName(filterId),
    }));
};

const downloadFilter = async (url: UrlType, filtersDir: string) => {
    console.info(`Download ${url.url}...`);

    const response = await axios.get(url.url, { responseType: 'arraybuffer' });

    await fs.promises.writeFile(path.join(filtersDir, url.file), response.data);

    console.info(`Download ${url.url} done`);
};

const startDownload = async () => {
    await ensureDir(FILTERS_DIR);

    const urls = getUrlsOfFiltersResources();
    await Promise.all(urls.map(url => downloadFilter(url, FILTERS_DIR)));
};

/**
 * Compiles rules to declarative json
 * Actually for each rule set entry in manifest's declarative_net_request:
 *
 * "declarative_net_request": {
 *   "rule_resources": [{
 *     "id": "ruleset_1",
 *     "enabled": true,
 *     "path": "filters/declarative/rules.json"
 *   }]
 * }
 *
 * we should find corresponding text file in resources, and then convert and save json to path specified in the manifest
 */
const precompileRules = async () => {
    await startDownload();

    await convertFilters(
        FILTERS_DIR,
        RESOURCES_DIR,
        DEST_RULE_SETS_DIR,
        true,
    );
};

precompileRules();
