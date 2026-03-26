import { NetworkRuleOption, type NetworkRule } from '@adguard/tsurlfilter';

/**
 * Utility functions for working with network rules.
 */
export class RuleUtils {
    /**
     * Checks if request rule is blocked.
     *
     * @param requestRule Request network rule or null.
     *
     * @returns True, if rule is request blocking, else returns false.
     */
    public static isRequestBlockedByRule(requestRule: NetworkRule | null): boolean {
        return !!requestRule
            && !requestRule.isAllowlist()
            && !requestRule.isOptionEnabled(NetworkRuleOption.Replace)
            && !requestRule.isOptionEnabled(NetworkRuleOption.Redirect);
    }
}
