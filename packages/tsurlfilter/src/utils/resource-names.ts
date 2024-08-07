const FILTER_PREFIX = 'filter_';

/**
 * Generates a text file name for a given filter ID.
 *
 * @param filterId - The ID of the filter.
 * @returns The generated file name in the format `filter_{filterId}.txt`.
 */
export const getFilterName = (filterId: number): string => {
    return `${FILTER_PREFIX}${filterId}.txt`;
};

/**
 * Generates a binary file name for a given filter ID.
 *
 * @param filterId - The ID of the filter.
 * @returns The generated file name in the format `filter_{filterId}.bin`.
 */
export const getFilterBinaryName = (filterId: number): string => {
    return `${FILTER_PREFIX}${filterId}.bin`;
};

/**
 * Generates a conversion map file name for a given filter ID.
 *
 * @param filterId - The ID of the filter.
 * @returns The generated file name in the format `filter_{filterId}_conversion_map.json`.
 */
export const getFilterConversionMapName = (filterId: number): string => {
    return `${FILTER_PREFIX}${filterId}_conversion_map.json`;
};

/**
 * Generates a source map file name for a given filter ID.
 *
 * @param filterId - The ID of the filter.
 * @returns The generated file name in the format `filter_{filterId}_source_map.json`.
 */
export const getFilterSourceMapName = (filterId: number): string => {
    return `${FILTER_PREFIX}${filterId}_source_map.json`;
};

/**
 * Extracts the filter ID from a given filter name.
 *
 * @param filterName - The filter name in the format `filter_{filterId}.txt`.
 * @returns The extracted filter ID, or null if the filter name does not match the expected format.
 */
export const getIdFromFilterName = (filterName: string): number | null => {
    const match = filterName.match(new RegExp(`${FILTER_PREFIX}(\\d+)\\.txt`));
    if (!match) {
        return null;
    }

    return parseInt(match[1], 10);
};
