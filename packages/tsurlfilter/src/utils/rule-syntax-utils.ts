import { getHostname } from 'tldts';

import { RuleFactory } from '../rules/rule-factory';
import { NetworkRule } from '../rules/network-rule';
import { CosmeticRule } from '../rules/cosmetic-rule';
import { DomainModifier } from '../modifiers/domain-modifier';

type RulesUnion = NetworkRule | CosmeticRule;

/**
 * Module with miscellaneous syntax utils exposed in API
 */
export class RuleSyntaxUtils {
    private static DUMMY_FILTER_ID = 0;

    /**
     * Checks if rule can be matched by domain
     * @param ruleText
     * @param domain
     */
    public static isRuleForDomain(ruleText: string, domain: string): boolean {
        const rule = RuleFactory.createRule(ruleText, this.DUMMY_FILTER_ID) as RulesUnion | null;
        if (!rule) {
            return false;
        }

        const permittedDomains = rule.getPermittedDomains();

        return !!permittedDomains
            && DomainModifier.isDomainOrSubdomainOfAny(domain, permittedDomains);
    }

    /**
     * Checks if rule can be matched by url
     * @param ruleText
     * @param url
     */
    public static isRuleForUrl(ruleText: string, url: string): boolean {
        const domain = getHostname(url);

        if (!domain) {
            return false;
        }

        return this.isRuleForDomain(ruleText, domain);
    }
}
