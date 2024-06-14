import fs from 'fs';
import path from 'path';
import { convertFilters } from '@adguard/tsurlfilter/cli';
import { getFilterName } from '@adguard/tswebextension/mv3/utils';
import axios from 'axios';
import { ensureDir } from 'fs-extra';
import { version } from './package.json';

const BASE_DIR = './dist';
const COMMON_FILTERS_DIR = `${BASE_DIR}/filters`;
const FILTERS_DIR = `${COMMON_FILTERS_DIR}`;
const DEST_RULE_SETS_DIR = `${COMMON_FILTERS_DIR}/declarative`;
const RESOURCES_DIR = '/war/redirects';

const FILTERS_SERVER_URL = 'https://filters.adtidy.org/extension/chromium';
const FILTERS_URL = `${FILTERS_SERVER_URL}/filters`;
const FILTERS_METADATA_URL = `${FILTERS_SERVER_URL}/filters.json`;

/**
 * Filter metadata.
 * @see https://github.com/AdguardTeam/FiltersRegistry?tab=readme-ov-file#metadata
 */
type FilterMetadata = {
    description: string;
    displayNumber: number;
    expires: number;
    filterId: number;
    groupId: number;
    homepage: string;
    name: string;
    tags: number[];
    version: string;
    languages: string[];
    timeAdded: string;
    timeUpdated: string;
    subscriptionUrl: string;
    diffPath?: string | undefined;
}

/**
 * Metadata response payload. 
 */
type FiltersMetadataResponse = {
    filters: FilterMetadata[];
}

/**
 * Filter data transfer object.
 */
type FilterDTO = {
    id: number,
    url: string,
    file: string,
};

/**
 * Downloads filter metadata from {@link FILTERS_METADATA_URL}.
 * @returns Filter metadata
 */
const getFiltersMetadata = async (): Promise<FilterMetadata[]> => {
    const res = await axios.get<FiltersMetadataResponse>(FILTERS_METADATA_URL);
    return res.data.filters;
}

/**
 * Gets {@link FilterDTO} array from filter metadata.
 * @returns Array of filter data.
 */
const getUrlsOfFiltersResources = async (): Promise<FilterDTO[]> => {
    const metadata = await getFiltersMetadata();
    return metadata.map(({ filterId }) => ({
        id: filterId,
        url: `${FILTERS_URL}/${filterId}.txt`,
        file: getFilterName(filterId),
    }));
};

/**
 * Downloads filter from the server and saves it to the specified directory.
 * @param filter Filter data transfer object.
 * @param filtersDir Filters directory.
 */
const downloadFilter = async (filter: FilterDTO, filtersDir: string) => {
    console.info(`Download ${filter.url}...`);

    const response = await axios.get(filter.url, { responseType: 'arraybuffer' });

    await fs.promises.writeFile(path.join(filtersDir, filter.file), response.data);

    console.info(`Download ${filter.url} done`);
};

/**
 * Downloads filters from the server and saves them to the specified directory.
 */
const startDownload = async (): Promise<void> => {
    await ensureDir(FILTERS_DIR);

    const urls = await getUrlsOfFiltersResources();
    await Promise.all(urls.map((url) => downloadFilter(url, FILTERS_DIR)));
};

/**
 * Creates build.txt file with package version.
 */
const createTxt = async (): Promise<void> => {
    return fs.promises.writeFile(
        path.join(BASE_DIR, 'build.txt'),
        `version=${version}`
    );
}

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
const build = async (): Promise<void> => {
    await startDownload();

    await convertFilters(
        FILTERS_DIR,
        RESOURCES_DIR,
        DEST_RULE_SETS_DIR,
        true,
    );

    await createTxt();
};

build();