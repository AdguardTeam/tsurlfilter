const FILTER_PREFIX = 'filter_';

/**
 * Extracts the filter ID from a given filter name.
 *
 * @param filterName The filter name in the format `filter_{filterId}.txt`.
 *
 * @returns The extracted filter ID, or null if the filter name does not match the expected format.
 */
export const getIdFromFilterName = (filterName: string): number | null => {
    const match = filterName.match(new RegExp(`${FILTER_PREFIX}(\\d+)\\.txt`));
    if (!match) {
        return null;
    }

    return parseInt(match[1], 10);
};
