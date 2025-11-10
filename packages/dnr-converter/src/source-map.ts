/**
 * Interface that contains the index number of
 * the source rule and the filter id of the rule.
 */
export interface SourceRuleIdxAndFilterId {
    /**
     * Index number of the source rule in the original filter list.
     */
    sourceRuleIndex: number;

    /**
     * Filter ID of the source rule.
     */
    filterId: number;
}

/**
 * Interface that contains the relationship between the original rules
 * (filter id with rule index) and the converted rules (declarative rule id).
 */
export interface Source extends SourceRuleIdxAndFilterId {
    /**
     * Declarative rule ID of the converted rule.
     */
    declarativeRuleId: number;
}
