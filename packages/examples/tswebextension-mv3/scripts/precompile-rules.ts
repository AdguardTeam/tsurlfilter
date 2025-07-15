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
const RESOURCES_DIR = '/web-accessible-resources/redirects';

const ADGUARD_FILTERS_IDS = DEFAULT_EXTENSION_CONFIG.staticFiltersIds;

const MV3_EXTENSION_FILTERS_SERVER_URL_FORMAT = 'https://filters.adtidy.org/extension/chromium-mv3';
const FILTER_DOWNLOAD_URL_FORMAT = `${MV3_EXTENSION_FILTERS_SERVER_URL_FORMAT}/filters/%filter.txt`;
// Note: .js for proper work caching in CDN.
const FILTERS_METADATA_URL = `${MV3_EXTENSION_FILTERS_SERVER_URL_FORMAT}/filters.js`;
const LOCAL_FILTERS_METADATA_FILENAME = 'filters.json';

export type UrlType = {
    id: number;
    url: string;
    file: string;
};

const getUrlsOfFiltersResources = () => {
    return ADGUARD_FILTERS_IDS.map((filterId: number) => ({
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

const downloadFiltersMetadata = async (url: string, filtersDir: string) => {
    console.info(`Download filters metadata from ${url}...`);

    // responseType 'text' since 'json' throws an error for some reason and we
    // actually do not need to parse it as JSON here, just save it as a file.
    const response = await axios.get(url, { responseType: 'text' });

    console.log(`Filters metadata response: ${response}`);

    const savePath = path.join(filtersDir, LOCAL_FILTERS_METADATA_FILENAME);

    await fs.promises.writeFile(savePath, response.data);

    console.info(`Download filters metadata done, saved to ${savePath}`);
};

const startDownload = async () => {
    await ensureDir(FILTERS_DIR);

    const urls = getUrlsOfFiltersResources();
    await Promise.all(urls.map((url: UrlType) => downloadFilter(url, FILTERS_DIR)));

    await downloadFiltersMetadata(
        FILTERS_METADATA_URL,
        FILTERS_DIR,
    );
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
        {
            debug: true,
            prettifyJson: true,
        },
    );
};

precompileRules();
