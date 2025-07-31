import { type AnyRule } from '@adguard/agtree';
import { getHostname } from 'tldts';

import { DomainModifier } from '../modifiers/domain-modifier';
import { type CosmeticRule } from '../rules/cosmetic-rule';
import { type NetworkRule } from '../rules/network-rule';
import { RuleFactory } from '../rules/rule-factory';

type RulesUnion = NetworkRule | CosmeticRule;

/**
 * Module with miscellaneous syntax utils exposed in API.
 */
export class RuleSyntaxUtils {
    private static DUMMY_FILTER_ID = 0;

    /**
     * Checks if rule can be matched by domain.
     *
     * @param node Rule node.
     * @param domain Domain to check.
     *
     * @returns True if the rule can be matched by the domain, false otherwise.
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
     * Checks if rule can be matched by URL.
     *
     * @param node Rule node.
     * @param url URL to check.
     *
     * @returns True if the rule can be matched by the URL, false otherwise.
     */
    public static isRuleForUrl(node: AnyRule, url: string): boolean {
        const domain = getHostname(url);

        if (!domain) {
            return false;
        }

        return this.isRuleForDomain(node, domain);
    }
}
