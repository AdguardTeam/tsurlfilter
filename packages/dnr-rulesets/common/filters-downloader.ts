import { METADATA_RULESET_ID, MetadataRuleSet } from '@adguard/tsurlfilter/es/declarative-converter';
import { getRuleSetPath } from '@adguard/tsurlfilter/es/declarative-converter-utils';
import axios from 'axios';
import fs from 'fs';
import { ensureDir } from 'fs-extra';
import path from 'path';

import {
    DEST_RULESETS_DIR,
    FILTERS_DIR,
    FILTERS_METADATA_I18N_FILE_NAME,
    FILTERS_URL,
    QUICK_FIXES_FILTER_ID,
} from './constants';
import {
    getI18nMetadata,
    getMetadata,
    Metadata,
} from './metadata';

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

    console.info(`Download ${filter.url} done, saved to ${path.join(filtersDir, filter.file)}`);
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
): Promise<Metadata> => {
    console.log(`Starting filters download to ${filtersDir}...`);

    await ensureDir(filtersDir);

    console.log(`Downloading filters metadata files...`);

    const metadata = await getMetadata();

    const i18nMetadata = await getI18nMetadata();

    await fs.promises.writeFile(
        path.join(filtersDir, FILTERS_METADATA_I18N_FILE_NAME),
        JSON.stringify(i18nMetadata, null, '\t'),
    );

    console.log(`Filters metadata saved to ${path.join(filtersDir, FILTERS_METADATA_I18N_FILE_NAME)}`);

    console.log(`Downloading filters resources to ${filtersDir}...`);

    const filters = await getUrlsOfFiltersResources(metadata);
    await Promise.all(filters.map((filter) => downloadFilter(filter, filtersDir)));

    return metadata;
};

/**
 * Writes metadata to the metadata ruleset.
 *
 * @param metadata Metadata to write.
 * @param destinationRulesetsPath Path to the destination rulesets directory.
 *
 * @returns Promise that resolves when metadata is written.
 */
export const writeMetadataFilesToMetadataRuleset = async (
    metadata: Metadata,
    destinationRulesetsPath: string = DEST_RULESETS_DIR,
): Promise<void> => {
    await ensureDir(destinationRulesetsPath);

    const metadataRuleSetPath = getRuleSetPath(METADATA_RULESET_ID, destinationRulesetsPath);
    const rawMetadataRuleSet = await fs.promises.readFile(metadataRuleSetPath, 'utf-8');
    const metadataRuleSet = MetadataRuleSet.deserialize(rawMetadataRuleSet);

    metadataRuleSet.setAdditionalProperty('metadata', metadata);

    await fs.promises.writeFile(metadataRuleSetPath, metadataRuleSet.serialize());
};
