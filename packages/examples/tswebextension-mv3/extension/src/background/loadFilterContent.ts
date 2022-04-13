import FiltersDownloader from '@adguard/filters-downloader/browser';

import { StorageKeys, storage } from './storage';

/**
 * Loads filters content from filters directory
 * @param filterId filter id to load
 * @param filtersDir directory with filters in txt format
 * @returns filter id and its content
 */
export const loadFilterContent = async (
    filterId: number,
    filtersDir: string,
): Promise<{ filterId: number, content: string }> => {
    const storageKey = `${StorageKeys.RULESET_PREFIX}_${filterId}`;

    let content = await storage.get<string>(storageKey);
    if (content === undefined) {
        const url = chrome.runtime.getURL(`${filtersDir}/filter_${filterId}.txt`);

        const response = await FiltersDownloader.download(
            url,
            {
                adguard: true,
                adguard_ext_chromium: true,
            },
        );
        content = response.join('\n');

        await storage.set(storageKey, content);
    }

    return {
        filterId,
        content,
    };
};
