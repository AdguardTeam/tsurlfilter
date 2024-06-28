import fs from 'fs';
import path from 'path';
import { convertFilters } from '@adguard/tsurlfilter/cli';
import axios from 'axios';
import { ensureDir } from 'fs-extra';

import { getMetadata, type Metadata } from './metadata';
import {
    FILTERS_URL,
    FILTERS_DIR,
    BASE_DIR,
    RESOURCES_DIR,
    DEST_RULE_SETS_DIR,
} from './constants';
import { version } from '../package.json';

/**
 * Filter data transfer object.
 */
type FilterDTO = {
    id: number,
    url: string,
    file: string,
};

/**
 * Gets {@link FilterDTO} array from filter metadata.
 * @param metadata Filters metadata downloaded from {@link FILTERS_METADATA_URL}
 * @returns Array of filter data.
 */
const getUrlsOfFiltersResources = async (
    metadata: Metadata
): Promise<FilterDTO[]> => {
    return metadata.filters.map(({ filterId }) => ({
        id: filterId,
        url: `${FILTERS_URL}/${filterId}.txt`,
        file: `filter_${filterId}.txt`,
    }));
};

/**
 * Downloads filter from the server and saves it to the specified directory.
 * @param filter Filter data transfer object.
 * @param filtersDir Filters directory.
 */
const downloadFilter = async (filter: FilterDTO, filtersDir: string) => {
    console.info(`Download ${filter.url}...`);

    const response = await axios.get<string>(filter.url, { responseType: 'text' });

    await fs.promises.writeFile(path.join(filtersDir, filter.file), response.data);

    console.info(`Download ${filter.url} done`);
};

/**
 * Downloads filters from the server and saves them to the specified directory.
 */
const startDownload = async (metadata: Metadata): Promise<void> => {
    await ensureDir(FILTERS_DIR);
    const urls = await getUrlsOfFiltersResources(metadata);
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
    const metadata = await getMetadata();
    await startDownload(metadata);

    await convertFilters(
        FILTERS_DIR,
        RESOURCES_DIR,
        DEST_RULE_SETS_DIR,
        true,
    );

    await createTxt();
};

build();