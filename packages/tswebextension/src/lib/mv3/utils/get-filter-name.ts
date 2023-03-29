/**
 * For the specified filter identifier the filter file name is generated with
 * an extension, in which the text filter rules should be saved.
 *
 * @param filterId Filter id.
 *
 * @returns Filter file name.
 */
export const getFilterName = (filterId: number): string => `filter_${filterId}.txt`;
