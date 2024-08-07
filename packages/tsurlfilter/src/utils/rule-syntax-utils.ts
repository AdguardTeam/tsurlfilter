import { getHostname } from 'tldts';

import { type AnyRule } from '@adguard/agtree';
import { RuleFactory } from '../rules/rule-factory';
import { type NetworkRule } from '../rules/network-rule';
import { type CosmeticRule } from '../rules/cosmetic-rule';
import { DomainModifier } from '../modifiers/domain-modifier';

type RulesUnion = NetworkRule | CosmeticRule;

/**
 * Module with miscellaneous syntax utils exposed in API
 */
export class RuleSyntaxUtils {
    private static DUMMY_FILTER_ID = 0;

    /**
     * Checks if rule can be matched by domain
     *
     * @param node Rule node
     * @param domain Domain to check
     */
    public static isRuleForDomain(node: AnyRule, domain: string): boolean {
        const rule = RuleFactory.createRule(node, this.DUMMY_FILTER_ID) as RulesUnion | null;
        if (!rule) {
            return false;
        }

        const permittedDomains = rule.getPermittedDomains();

        return !!permittedDomains
            && DomainModifier.isDomainOrSubdomainOfAny(domain, permittedDomains);
    }

    /**
     * Checks if rule can be matched by URL
     *
     * @param node Rule node
     * @param url URL to check
     */
    public static isRuleForUrl(node: AnyRule, url: string): boolean {
        const domain = getHostname(url);

        if (!domain) {
            return false;
        }

        return this.isRuleForDomain(node, domain);
    }
}
