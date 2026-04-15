import fs from 'node:fs';
import path from 'node:path';

import axios from 'axios';
import { ensureDir } from 'fs-extra';

import {
    BrowserFilters,
    FILTERS_BROWSER_PLACEHOLDER,
    FILTERS_URL,
    LOCAL_I18N_METADATA_FILE_NAME,
    LOCAL_METADATA_FILE_NAME,
} from './constants';
import { downloadI18nMetadata, downloadMetadata, type Metadata } from './metadata';

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
 *
 * @param metadata Filters metadata downloaded for given `browser`.
 * @param browser Browser to get URL of filters for. Defaults to `BrowserFilters.ChromiumMv3`.
 *
 * @returns Array of filter data.
 */
const getUrlsOfFiltersResources = (
    metadata: Metadata,
    browser: BrowserFilters = BrowserFilters.ChromiumMv3,
): FilterDTO[] => {
    return metadata.filters.map(({ filterId }) => ({
        id: filterId,
        url: `${FILTERS_URL.replace(FILTERS_BROWSER_PLACEHOLDER, browser)}/${filterId}.txt`,
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

    const pathToSave = path.join(filtersDir, filter.file);

    await fs.promises.writeFile(pathToSave, response.data);

    console.info(`Download ${filter.url} done, saved to ${pathToSave}`);
};

/**
 * Downloads filters from the server and saves them to the specified directory.
 *
 * @param filtersDir Directory to save filters to.
 * @param browser Browser to download filters for. Defaults to `BrowserFilters.ChromiumMv3`.
 * @param allowedFilterIds Optional set of filter IDs to download. If provided, only filters
 * whose IDs are in this set will be downloaded; others are skipped and logged.
 * If not provided, all filters from metadata are downloaded.
 *
 * @returns Promise that resolves when all filters are downloaded.
 */
export const startDownload = async (
    filtersDir: string,
    browser: BrowserFilters = BrowserFilters.ChromiumMv3,
    allowedFilterIds?: Set<number>,
): Promise<void> => {
    console.log(`Starting filters download to ${filtersDir}...`);

    await ensureDir(filtersDir);

    console.log(`Downloading filters metadata files...`);

    const metadataPathToSave = path.join(filtersDir, LOCAL_METADATA_FILE_NAME);
    const metadata = await downloadMetadata(metadataPathToSave, browser);

    const i18nMetadataPathToSave = path.join(filtersDir, LOCAL_I18N_METADATA_FILE_NAME);
    await downloadI18nMetadata(i18nMetadataPathToSave, browser);

    // If an allowlist is provided, filter metadata to only include known filters.
    // This prevents unknown/new filters from being downloaded and included in the build.
    if (allowedFilterIds) {
        const skippedIds = metadata.filters
            .filter(({ filterId }) => !allowedFilterIds.has(filterId))
            .map(({ filterId }) => filterId);

        if (skippedIds.length > 0) {
            console.info(`Skipping filters not in old validator data for ${browser}: ${skippedIds.join(', ')}`);
        }

        metadata.filters = metadata.filters.filter(({ filterId }) => allowedFilterIds.has(filterId));

        // Re-save filtered metadata so that convertFilters only sees allowed filters.
        await fs.promises.writeFile(
            metadataPathToSave,
            JSON.stringify(metadata, null, '\t'),
        );
    }

    console.log(`Downloading filters resources to ${filtersDir}...`);

    const filters = getUrlsOfFiltersResources(metadata, browser);
    await Promise.all(filters.map((filter) => downloadFilter(filter, filtersDir)));
};
