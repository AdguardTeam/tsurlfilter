import type { AnyRule, FilterList } from '@adguard/agtree';
import { CosmeticRuleType, FilterListPipeline, RuleCategory } from '@adguard/agtree';

/**
 * Shared pipeline instance reused across all parse calls.
 */
const pipeline = new FilterListPipeline();

/**
 * Parses a filter list string into an AST.
 *
 * @param filterStr Filter list content.
 *
 * @returns Parsed filter list node.
 */
export const parseFilterList = (filterStr: string): FilterList => {
    return pipeline.parse(filterStr, {
        isLocIncluded: true,
        tolerant: true,
    });
};

/**
 * Checks if a rule node is a JS injection rule.
 *
 * @param ruleNode Rule node to check.
 *
 * @returns True if the rule node is a JS injection rule, false otherwise.
 */
export const isJsInjectionRule = (ruleNode: AnyRule): boolean => {
    return ruleNode.category === RuleCategory.Cosmetic
        && ruleNode.type === CosmeticRuleType.JsInjectionRule;
};

/**
 * Extracts the source text of a rule node from the raw filter string
 * using its location offsets. Falls back to `'unknown rule'` if the
 * slice yields an empty string (e.g. when offsets are missing).
 *
 * @param filterStr Raw filter list content.
 * @param ruleNode Rule node with location offsets.
 *
 * @returns The rule's source text, or `'unknown rule'` as a fallback.
 */
export const getRuleSourceText = (filterStr: string, ruleNode: AnyRule): string => {
    // `slice(undefined, undefined)` would return the whole filter list, so
    // guard explicitly for missing offsets before slicing.
    if (ruleNode.start === undefined || ruleNode.end === undefined) {
        return 'unknown rule';
    }

    return filterStr.slice(ruleNode.start, ruleNode.end) || 'unknown rule';
};
