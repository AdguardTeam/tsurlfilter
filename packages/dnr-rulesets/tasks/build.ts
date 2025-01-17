import { convertFilters } from '@adguard/tsurlfilter/cli';
import axios from 'axios';
import fs from 'fs';
import { ensureDir } from 'fs-extra';
import path from 'path';

import { version } from '../package.json';
import {
    BASE_DIR,
    DEST_RULE_SETS_DIR,
    FILTERS_DIR,
    FILTERS_METADATA_FILE_NAME,
    FILTERS_METADATA_I18N_FILE_NAME,
    FILTERS_URL,
    QUICK_FIXES_FILTER_ID,
    RESOURCES_DIR,
} from './constants';
import { getI18nMetadata, getMetadata, type Metadata } from './metadata';

/**
 * Filter data transfer object.
 */
type FilterDTO = {
    id: number;
    url: string;
    file: string;
};

/**
 * Gets {@link FilterDTO} array from filter metadata.
 * AdGuard Quick Fixes filter is excluded from downloading and conversion.
 *
 * @param metadata Filters metadata downloaded from `FILTERS_METADATA_URL`
 * @returns Array of filter data.
 */
const getUrlsOfFiltersResources = async (
    metadata: Metadata,
): Promise<FilterDTO[]> => {
    return metadata.filters
        // We exclude this filter from downloading and conversion,
        // because it should be loaded from the server on the client and applied
        // dynamically.
        .filter(({ filterId }) => filterId !== QUICK_FIXES_FILTER_ID)
        .map(({ filterId }) => ({
            id: filterId,
            url: `${FILTERS_URL}/${filterId}.txt`,
            file: `filter_${filterId}.txt`,
        }));
};

/**
 * Downloads filter from the server and saves it to the specified directory.
 *
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
 *
 * @returns Promise that resolves when all filters are downloaded.
 */
const startDownload = async (): Promise<void> => {
    await ensureDir(FILTERS_DIR);

    const metadata = await getMetadata();

    await fs.promises.writeFile(
        path.join(FILTERS_DIR, FILTERS_METADATA_FILE_NAME),
        JSON.stringify(metadata, null, '\t'),
    );

    const i18nMetadata = await getI18nMetadata();

    await fs.promises.writeFile(
        path.join(FILTERS_DIR, FILTERS_METADATA_I18N_FILE_NAME),
        JSON.stringify(i18nMetadata, null, '\t'),
    );

    const filters = await getUrlsOfFiltersResources(metadata);
    await Promise.all(filters.map((filter) => downloadFilter(filter, FILTERS_DIR)));
};

/**
 * Creates build.txt file with package version.
 *
 * @returns Promise that resolves when build.txt is created.
 */
const createTxt = async (): Promise<void> => {
    return fs.promises.writeFile(
        path.join(BASE_DIR, 'build.txt'),
        `version=${version}`,
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
const build = async (): Promise<void> => {
    await startDownload();
    await convertFilters(
        FILTERS_DIR,
        RESOURCES_DIR,
        DEST_RULE_SETS_DIR,
        {
            debug: true,
            prettifyJson: false,
        },
    );

    await createTxt();
};

build();
