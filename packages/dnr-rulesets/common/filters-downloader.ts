import fs from 'node:fs';
import path from 'node:path';

import axios from 'axios';
import { ensureDir } from 'fs-extra';

import {
    BrowserFilters,
    FILTERS_BROWSER_STUB,
    FILTERS_URL,
    LOCAL_I18N_METADATA_FILE_NAME,
    LOCAL_METADATA_FILE_NAME,
    QUICK_FIXES_FILTER_ID,
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
 * AdGuard Quick Fixes filter is excluded from downloading and conversion.
 *
 * @param metadata Filters metadata downloaded for given `browser`.
 * @param browser Browser to get URL of filters for. Defaults to `BrowserFilters.ChromiumMV3`.
 *
 * @returns Array of filter data.
 */
const getUrlsOfFiltersResources = async (
    metadata: Metadata,
    browser: BrowserFilters = BrowserFilters.ChromiumMV3,
): Promise<FilterDTO[]> => {
    return metadata.filters
        // We exclude this filter from downloading and conversion,
        // because it should be loaded from the server on the client and applied
        // dynamically.
        .filter(({ filterId }) => filterId !== QUICK_FIXES_FILTER_ID)
        .map(({ filterId }) => ({
            id: filterId,
            url: `${FILTERS_URL.replace(FILTERS_BROWSER_STUB, browser)}/${filterId}.txt`,
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
 * @param browser Browser to download filters for. Defaults to `BrowserFilters.ChromiumMV3`.
 *
 * @returns Promise that resolves the filters metadata.
 */
export const startDownload = async (
    filtersDir: string,
    browser: BrowserFilters = BrowserFilters.ChromiumMV3,
): Promise<void> => {
    console.log(`Starting filters download to ${filtersDir}...`);

    await ensureDir(filtersDir);

    console.log(`Downloading filters metadata files...`);

    const metadataPathToSave = path.join(filtersDir, LOCAL_METADATA_FILE_NAME);
    const metadata = await downloadMetadata(metadataPathToSave, browser);

    const i18nMetadataPathToSave = path.join(filtersDir, LOCAL_I18N_METADATA_FILE_NAME);
    await downloadI18nMetadata(i18nMetadataPathToSave, browser);

    console.log(`Downloading filters resources to ${filtersDir}...`);

    const filters = await getUrlsOfFiltersResources(metadata, browser);
    await Promise.all(filters.map((filter) => downloadFilter(filter, filtersDir)));
};
