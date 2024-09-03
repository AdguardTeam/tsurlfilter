/**
 * Creates tag for filter list metadata.
 *
 * @param tagName Name of the tag.
 * @param value Value of the tag.
 * @param lineEnding Line ending to use in created tag.
 *
 * @returns Created tag in `! ${tagName}: ${value}` format.
 */
export declare const createTag: (tagName: string, value: string, lineEnding: string) => string;
/**
 * Finds value of specified header tag in filter rules text.
 *
 * @param tagName Filter header tag name.
 * @param rules Lines of filter rules text.
 *
 * @returns Trimmed value of specified header tag or null if tag not found.
 */
export declare const parseTag: (tagName: string, rules: string[]) => string | null;
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
export declare const removeTag: (tagName: string, filterContent: string[]) => string[];
