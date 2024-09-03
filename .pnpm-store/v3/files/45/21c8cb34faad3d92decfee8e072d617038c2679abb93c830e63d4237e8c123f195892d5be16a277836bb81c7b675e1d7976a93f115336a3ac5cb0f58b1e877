import { NetworkRule, NetworkRuleOption } from '../rules/network-rule';
import { CookieModifier } from '../modifiers/cookie-modifier';

/**
 * Cookie rules manager class
 */
export default class CookieRulesFinder {
    /**
     * Filters blocking rules
     * Used in content scripts
     *
     * @param url
     * @param rules
     */
    static getBlockingRules(url: string, rules: NetworkRule[]): NetworkRule[] {
        return rules.filter((rule) => !CookieRulesFinder.isModifyingRule(rule));
    }

    /**
     * Finds a rule that doesn't modify cookie: i.e. this rule cancels cookie or it's a allowlist rule.
     *
     * @param cookieName Cookie name
     * @param rules Matching rules
     * @param isThirdPartyCookie
     * @return Found rule or null
     */
    static lookupNotModifyingRule(
        cookieName: string,
        rules: NetworkRule[],
        isThirdPartyCookie: boolean,
    ): NetworkRule | null {
        const blockingRules: NetworkRule[] = [];
        const allowlistRules: NetworkRule[] = [];

        for (let i = 0; i < rules.length; i += 1) {
            const rule = rules[i];
            if (!CookieRulesFinder.matchThirdParty(rule, isThirdPartyCookie)) {
                continue;
            }

            const cookieModifier = rule.getAdvancedModifier() as CookieModifier;
            if (cookieModifier.matches(cookieName) && !CookieRulesFinder.isModifyingRule(rule)) {
                if (rule.isAllowlist()) {
                    allowlistRules.push(rule);
                } else {
                    blockingRules.push(rule);
                }
            }
        }

        if (allowlistRules.length > 0) {
            return allowlistRules[0];
        }

        if (blockingRules.length > 0) {
            return blockingRules[0];
        }

        return null;
    }

    /**
     * Finds rules that modify cookie
     *
     * @param cookieName Cookie name
     * @param rules Matching rules
     * @param isThirdPartyCookie
     * @return Modifying rules
     */
    static lookupModifyingRules(
        cookieName: string,
        rules: NetworkRule[],
        isThirdPartyCookie: boolean,
    ): NetworkRule[] {
        const result: NetworkRule[] = [];
        const allowlistRules: NetworkRule[] = [];

        if (rules && rules.length > 0) {
            for (let i = 0; i < rules.length; i += 1) {
                const rule = rules[i];
                if (!CookieRulesFinder.matchThirdParty(rule, isThirdPartyCookie)) {
                    continue;
                }

                const cookieModifier = rule.getAdvancedModifier() as CookieModifier;
                if (!cookieModifier.matches(cookieName)) {
                    continue;
                }

                if (!rule.isAllowlist() && !CookieRulesFinder.isModifyingRule(rule)) {
                    return [];
                }

                if (rule.isAllowlist()) {
                    allowlistRules.push(rule);
                } else {
                    result.push(rule);
                }
            }
        }

        if (allowlistRules.length > 0) {
            return allowlistRules;
        }

        return result;
    }

    /**
     * Checks if rule and third party flag matches
     *
     * @param rule
     * @param isThirdParty
     */
    private static matchThirdParty(rule: NetworkRule, isThirdParty: boolean): boolean {
        if (!rule.isOptionEnabled(NetworkRuleOption.ThirdParty)) {
            return true;
        }

        return isThirdParty === rule.isOptionEnabled(NetworkRuleOption.ThirdParty);
    }

    /**
     * Checks if $cookie rule is modifying
     *
     * @param rule $cookie rule
     * @return result
     */
    private static isModifyingRule(rule: NetworkRule): boolean {
        const cookieModifier = rule.getAdvancedModifier() as CookieModifier;
        return cookieModifier.getSameSite() !== null
            || (cookieModifier.getMaxAge() !== null && cookieModifier.getMaxAge()! > 0);
    }
}
