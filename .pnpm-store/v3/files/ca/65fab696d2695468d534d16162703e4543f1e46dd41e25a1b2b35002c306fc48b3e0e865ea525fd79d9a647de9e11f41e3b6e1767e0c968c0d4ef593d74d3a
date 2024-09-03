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
 * Finds value of specified header tag in filter rules text.
 *
 * @param tagName Filter header tag name.
 * @param rules Lines of filter rules text.
 *
 * @returns Trimmed value of specified header tag or null if tag not found.
 */
export const parseTag = (tagName: string, rules: string[]): string | null => {
    // Look up no more than 50 first lines
    const maxLines = Math.min(AMOUNT_OF_LINES_TO_PARSE, rules.length);
    for (let i = 0; i < maxLines; i += 1) {
        const rule = rules[i];

        if (!rule) {
            continue;
        }

        const search = `! ${tagName}: `;
        const indexOfSearch = rule.indexOf(search);

        if (indexOfSearch >= 0) {
            return rule.substring(indexOfSearch + search.length).trim();
        }
    }

    return null;
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
