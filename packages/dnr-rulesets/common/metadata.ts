import fs from 'node:fs';

import axios from 'axios';

import { FILTERS_METADATA_I18N_URL, FILTERS_METADATA_URL } from './constants';

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
 *
 * @returns Filter metadata.
 */
export async function downloadMetadata(pathToSave?: string): Promise<Metadata> {
    console.info(`Download ${FILTERS_METADATA_URL}...`);

    const { data } = await axios.get<Metadata>(FILTERS_METADATA_URL, { responseType: 'json' });

    if (pathToSave) {
        await fs.promises.writeFile(
            pathToSave,
            JSON.stringify(data, null, '\t'),
        );

        console.info(`Download ${FILTERS_METADATA_URL} done, saved to ${pathToSave}`);
    }

    return data;
}

/**
 * Download i18n metadata from {@link FILTERS_METADATA_I18N_URL}.
 *
 * @param pathToSave Path to save i18n metadata file.
 *
 * @returns I18n Filter metadata.
 */
export async function downloadI18nMetadata(pathToSave: string): Promise<unknown> {
    console.info(`Download ${FILTERS_METADATA_I18N_URL}...`);

    const { data } = await axios.get(FILTERS_METADATA_I18N_URL);

    await fs.promises.writeFile(
        pathToSave,
        JSON.stringify(data, null, '\t'),
    );

    console.info(`Download ${FILTERS_METADATA_I18N_URL} done, saved to ${pathToSave}`);

    return data;
}
