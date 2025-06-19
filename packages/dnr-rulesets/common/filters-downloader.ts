import fs from 'node:fs';
import path from 'node:path';

import axios from 'axios';
import { ensureDir } from 'fs-extra';

import {
    FILTERS_DIR,
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
 * @param metadata Filters metadata downloaded from `FILTERS_METADATA_URL`.
 *
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

    const pathToSave = path.join(filtersDir, filter.file);

    await fs.promises.writeFile(pathToSave, response.data);

    console.info(`Download ${filter.url} done, saved to ${pathToSave}`);
};

/**
 * Downloads filters from the server and saves them to the specified directory.
 *
 * @param filtersDir Directory to save filters to. Defaults to `FILTERS_DIR`.
 *
 * @returns Promise that resolves the filters metadata.
 */
export const startDownload = async (
    filtersDir: string = FILTERS_DIR,
): Promise<void> => {
    console.log(`Starting filters download to ${filtersDir}...`);

    await ensureDir(filtersDir);

    console.log(`Downloading filters metadata files...`);

    const metadataPathToSave = path.join(filtersDir, LOCAL_METADATA_FILE_NAME);
    const metadata = await downloadMetadata(metadataPathToSave);

    const i18nMetadataPathToSave = path.join(filtersDir, LOCAL_I18N_METADATA_FILE_NAME);
    await downloadI18nMetadata(i18nMetadataPathToSave);

    console.log(`Downloading filters resources to ${filtersDir}...`);

    const filters = await getUrlsOfFiltersResources(metadata);
    await Promise.all(filters.map((filter) => downloadFilter(filter, filtersDir)));
};
