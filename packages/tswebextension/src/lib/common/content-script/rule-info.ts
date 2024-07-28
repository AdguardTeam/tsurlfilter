/**
 * Information about a rule stored in the content styles attribute.
 */
export interface RuleInfo {
    /**
     * ID of the filter that the rule belongs to.
     */
    filterId: number;

    /**
     * Index that points to the original rule text in the filter list.
     */
    ruleIndex: number;
}
