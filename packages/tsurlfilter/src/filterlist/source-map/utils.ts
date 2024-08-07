import { RULE_INDEX_NONE } from '../../rules/rule';
import { findNextLineBreakIndex } from '../../utils/string-utils';
import { type FilterListSourceMap } from './schema';

/**
 * Helper function to get the rule source text from the source string by its line start index.
 *
 * @param lineStartIndex Rule start index.
 * @param source Raw filter list source.
 * @returns Rule string or null if the rule couldn't be found.
 */
export const getRuleSourceText = (lineStartIndex: number, source: string): string | null => {
    // note: checking for LF is enough, because we transform source before storing it, and it's always LF
    let [lineEndIndex] = findNextLineBreakIndex(source, lineStartIndex);

    // If the line end index is not found, we assume that the rule is the last line in the source.
    if (lineEndIndex === -1) {
        lineEndIndex = source.length;
    }

    // If the rule start index is equal to or greater than the rule end index, we return null,
    // and the rule is considered not found.
    if (lineStartIndex >= lineEndIndex) {
        return null;
    }

    return source.slice(lineStartIndex, lineEndIndex);
};

/**
 * Helper function to get the rule source index (line start index in the source) from the source map by the rule index.
 *
 * @param ruleIdx Rule index.
 * @param sourceMap Source map.
 * @returns Rule source index or RULE_INDEX_NONE (-1).
 * @note Similar to `Array.prototype.indexOf`, we return -1 if the rule index is not found.
 */
export const getRuleSourceIndex = (ruleIdx: number, sourceMap: FilterListSourceMap): number => {
    return sourceMap[ruleIdx] ?? RULE_INDEX_NONE;
};
