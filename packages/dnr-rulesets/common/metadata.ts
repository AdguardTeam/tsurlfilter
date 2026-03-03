import fs from 'node:fs';

import axios from 'axios';

import {
    BrowserFilters,
    FILTERS_BROWSER_PLACEHOLDER,
    FILTERS_METADATA_I18N_URL,
    FILTERS_METADATA_URL,
} from './constants';

/**
 * Filter metadata.
 *
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
};

/**
 * Filter groups metadata.
 *
 * @see https://github.com/AdguardTeam/FiltersRegistry?tab=readme-ov-file#-groups
 */
type GroupMetadata = {
    groupId: number;
    groupName: string;
    displayNumber: number;
};

/**
 * Metadata response payload.
 */
export type Metadata = {
    filters: FilterMetadata[];
    groups: GroupMetadata[];
};

/**
 * Download metadata from {@link FILTERS_METADATA_URL}.
 *
 * @param pathToSave Path to save metadata file.
 * @param browser Browser to download filters metadata for. Defaults to `BrowserFilters.ChromiumMv3`.
 *
 * @returns Filter metadata.
 */
export async function downloadMetadata(
    pathToSave?: string,
    browser: BrowserFilters = BrowserFilters.ChromiumMv3,
): Promise<Metadata> {
    const metadataUrl = FILTERS_METADATA_URL.replace(FILTERS_BROWSER_PLACEHOLDER, browser);

    console.info(`Download ${metadataUrl}...`);

    const { data } = await axios.get<Metadata>(metadataUrl, { responseType: 'json' });

    if (pathToSave) {
        await fs.promises.writeFile(
            pathToSave,
            JSON.stringify(data, null, '\t'),
        );

        console.info(`Download ${metadataUrl} done, saved to ${pathToSave}`);
    }

    return data;
}

/**
 * Download i18n metadata from {@link FILTERS_METADATA_I18N_URL}.
 *
 * @param pathToSave Path to save i18n metadata file.
 * @param browser Browser to download filters I18n metadata for. Defaults to `BrowserFilters.ChromiumMv3`.
 *
 * @returns I18n Filter metadata.
 */
export async function downloadI18nMetadata(
    pathToSave: string,
    browser: BrowserFilters = BrowserFilters.ChromiumMv3,
): Promise<unknown> {
    const i18nMetadataUrl = FILTERS_METADATA_I18N_URL.replace(FILTERS_BROWSER_PLACEHOLDER, browser);

    console.info(`Download ${i18nMetadataUrl}...`);

    const { data } = await axios.get(i18nMetadataUrl);

    await fs.promises.writeFile(
        pathToSave,
        JSON.stringify(data, null, '\t'),
    );

    console.info(`Download ${i18nMetadataUrl} done, saved to ${pathToSave}`);

    return data;
}
