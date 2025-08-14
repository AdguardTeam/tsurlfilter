import { RULE_INDEX_NONE } from '../../rules/rule';
import { findNextLineBreakIndex } from '../../utils/string-utils';

import { type FilterListSourceMap } from './schema';

/**
 * Helper function to get the rule source text from the source string by its line start index.
 *
 * @param lineStartIndex Rule start index.
 * @param source Raw filter list source.
 *
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

    const ruleSourceText = source.slice(lineStartIndex, lineEndIndex);

    // WARNING!
    // Potential memory leak mitigation for substring operation due to V8 optimizations:
    // When extracting a substring with rule.slice(), there's a concern in some JS environments
    // that the resulting substring might retain a hidden reference to the entire original 'rule' string.
    // This could prevent the garbage collector (GC) from freeing the memory allocated for filter rules.
    // This hidden reference occurs because the substring might not create a new string but rather
    // a view into the original, keeping it in memory longer than necessary.
    // And we receive a memory leak here because we store parsed tags from first N lines of the filter rules
    // which have references to the original large string with filter rules.
    // To ensure that the original large string can be garbage collected, and only the necessary
    // substring is retained, we explicitly force a copy of the substring via split and join,
    // thereby breaking the direct reference to the original string and allowing the GC to free the memory
    // for filter rules when they are no longer in use.
    return ruleSourceText.split('').join('');
};

/**
 * Helper function to get the rule source index (line start index in the source) from the source map by the rule index.
 *
 * @param ruleIdx Rule index.
 * @param sourceMap Source map.
 *
 * @returns Rule source index or RULE_INDEX_NONE (-1).
 *
 * @note Similar to `Array.prototype.indexOf`, we return -1 if the rule index is not found.
 */
export const getRuleSourceIndex = (ruleIdx: number, sourceMap: FilterListSourceMap): number => {
    return sourceMap[ruleIdx] ?? RULE_INDEX_NONE;
};
