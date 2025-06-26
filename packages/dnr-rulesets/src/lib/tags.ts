// Lines of filter metadata to parse
const AMOUNT_OF_LINES_TO_PARSE = 50;

/**
 * Creates tag for filter list metadata.
 *
 * @param tagName Name of the tag.
 * @param value Value of the tag.
 * @param lineEnding Line ending to use in created tag.
 *
 * @returns Created tag in `! ${tagName}: ${value}` format.
 */
export const createTag = (
    tagName: string,
    value: string,
    lineEnding: string,
): string => {
    return `! ${tagName}: ${value}${lineEnding}`;
};

/**
 * Removes a specified tag from an array of filter content strings.
 * This function searches for the first occurrence of the specified tag within
 * the array and removes the entire line containing that tag. If the tag is not
 * found, the array remains unchanged.
 *
 * @param tagName The name of the tag to be removed from the filter content.
 * @param filterContent An array of strings, each representing a line of filter content.
 *
 * @returns A new array of filter content with the specified tag removed.
 * If the tag is not found, the original array is returned unmodified.
 */
export const removeTag = (
    tagName: string,
    filterContent: string[],
): string[] => {
    // Make copy of array to avoid mutation.
    const copy = filterContent.slice();

    // Cut first 50 lines to parse. We don't need to parse all file.
    const updatedFile = filterContent.slice(
        0,
        Math.min(AMOUNT_OF_LINES_TO_PARSE, filterContent.length),
    );

    const tagIdx = updatedFile.findIndex((line) => line.includes(tagName));

    if (tagIdx >= 0) {
        copy.splice(tagIdx, 1);
    }

    return copy;
};
