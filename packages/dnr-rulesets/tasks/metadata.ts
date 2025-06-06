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
 * @returns Filter metadata.
 */
export async function getMetadata(): Promise<Metadata> {
    const res = await axios.get<Metadata>(FILTERS_METADATA_URL);
    return res.data;
}

/**
 * Download i18n metadata from {@link FILTERS_METADATA_I18N_URL}.
 *
 * @returns I18n Filter metadata.
 */
export async function getI18nMetadata(): Promise<unknown> {
    const res = await axios.get(FILTERS_METADATA_I18N_URL);
    return res.data;
}
