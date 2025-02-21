/**
 * @file Helper functions to download filter lists.
 */
import { type DownloadedFilterListResource, type FilterListResource } from '../interfaces';
import { fetchFile } from './fetch-file';

/**
 * Helper function to download filter lists.
 *
 * @param filterLists Filter lists to download.
 * @returns Downloaded filter lists.
 */
export const downloadFilterLists = async (
    filterLists: FilterListResource[],
): Promise<DownloadedFilterListResource[]> => {
    const downloadedFilterLists: DownloadedFilterListResource[] = [];

    for (const filterList of filterLists) {
        const contents = await fetchFile(filterList.url);
        downloadedFilterLists.push({ ...filterList, contents });
    }

    return downloadedFilterLists;
};
