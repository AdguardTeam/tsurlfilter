/**
 * @file Shared types and the base ruleset interface used across both the
 * simple ({@link IRuleset}) and source-map ({@link IRulesetWithSourceMap})
 * conversion flows.
 */

/**
 * The OriginalSource contains the text of the original rule and the filter
 * identifier of that rule.
 */
export type SourceRuleAndFilterId = {
    /**
     * Text of the original source rule.
     */
    sourceRule: string;

    /**
     * Identifier of the filter list that contains this rule.
     */
    filterId: number;
};

/**
 * Describes object of ruleset id with list of ids of declarative rules. Needs
 * to disable declarative rules from static ruleset by applying $badfilter rules
 * from dynamic rulesets.
 */
export type UpdateStaticRulesOptions = {
    /**
     * Identifier of the static ruleset.
     */
    rulesetId: string;

    /**
     * List of declarative rule IDs to disable in the static ruleset.
     */
    disableRuleIds: number[];
};

/**
 * Shared base interface for any rule set holding converted declarative rules.
 * Contains only the counters and identifier common to both the simple and
 * source-map conversion flows. Use {@link IRuleset} or
 * {@link IRulesetWithSourceMap} for flow-specific methods.
 */
export interface IBaseRuleset {
    /**
     * Number of converted declarative rules.
     *
     * @returns Number of converted declarative rules.
     */
    getRulesCount(): number;

    /**
     * Number of converted declarative unsafe rules.
     *
     * @returns Number of converted declarative unsafe rules.
     */
    getUnsafeRulesCount(): number;

    /**
     * Number of converted declarative regexp rules.
     *
     * @returns Number of converted declarative regexp rules.
     */
    getRegexpRulesCount(): number;

    /**
     * Returns rule set id.
     *
     * @returns Rule set id.
     */
    getId(): string;
}
