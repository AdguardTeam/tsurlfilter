import { OPTION_NAMES } from '../rule/option-names';
import { type Rule } from '../rule/rule';

/**
 * Rule groups for declarative rules.
 */
export enum RulesGroup {
    /**
     * Regular rules (also handles `$removeparam` — no longer merged,
     * each rule produces its own DNR rule with a param-aware urlFilter
     * for multi-hop redirect chaining).
     */
    Regular = 0,

    /**
     * `$removeheader` rules.
     */
    RemoveHeader = 1,

    /**
     * `$csp` rules.
     */
    Csp = 2,

    /**
     * `$badfilter` rules.
     *
     * These rules are not converted to declarative rules, but are used
     * to negate other rules during the conversion process.
     */
    BadFilter = 3,

    /**
     * `$urltransform` rules.
     */
    UrlTransform = 4,
}

/**
 * Object that contains grouped rules where key is {@link RulesGroup}
 * and value is an array of {@link Rule}.
 */
export type GroupedRules = Record<RulesGroup, Rule[]>;

/**
 * Utility class to group list of {@link Rule} into {@link GroupedRules}.
 */
export class RulesGrouper {
    /**
     * Returns group for provided `rule`.
     *
     * @param rule {@link Rule} to get group for.
     *
     * @returns Rule group ({@link RulesGroup}).
     */
    private static getRuleGroup(rule: Rule): RulesGroup {
        if (rule.isModifierEnabled(OPTION_NAMES.REMOVEHEADER)) {
            return RulesGroup.RemoveHeader;
        }

        if (rule.isModifierEnabled(OPTION_NAMES.CSP)) {
            return RulesGroup.Csp;
        }

        if (rule.isModifierEnabled(OPTION_NAMES.BADFILTER)) {
            return RulesGroup.BadFilter;
        }

        if (rule.isModifierEnabled(OPTION_NAMES.URLTRANSFORM)) {
            return RulesGroup.UrlTransform;
        }

        return RulesGroup.Regular;
    }

    /**
     * Groups the list of {@link Rule} into {@link GroupedRules}.
     *
     * @param rules List of {@link Rule} to group.
     *
     * @returns Grouped result of {@link GroupedRules}.
     */
    public static groupRules(rules: Rule[]): GroupedRules {
        const groupedRules: GroupedRules = {
            [RulesGroup.RemoveHeader]: [],
            [RulesGroup.BadFilter]: [],
            [RulesGroup.Regular]: [],
            [RulesGroup.Csp]: [],
            [RulesGroup.UrlTransform]: [],
        };

        for (let i = 0; i < rules.length; i += 1) {
            const rule = rules[i];
            const group = RulesGrouper.getRuleGroup(rule);
            groupedRules[group].push(rule);
        }

        return groupedRules;
    }
}
