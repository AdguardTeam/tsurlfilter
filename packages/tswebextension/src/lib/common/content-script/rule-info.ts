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

/**
 * Optional information about a rule stored in the content styles attribute.
 */
export interface RuleInfoOptional {
    /**
     * ID of the filter that the rule belongs to.
     *
     * Can be `null` if the rule cannot be matched for the request,
     * e.g. during onErrorOccurred for company category matching.
     */
    filterId: number | null;

    /**
     * Index that points to the original rule text in the filter list.
     *
     * Can be `null` if the rule cannot be matched for the request,
     * e.g. during onErrorOccurred for company category matching.
     */
    ruleIndex: number | null;
}
