import { RuleGenerator } from '@adguard/agtree';

import { createAllowlistRuleNode } from './allowlist';
import { CosmeticRule } from './cosmetic-rule';
import { HostRule } from './host-rule';
import { NetworkRule } from './network-rule';
import { type IRule, RULE_INDEX_NONE } from './rule';

/**
 * Rule builder class.
 */
export class RuleFactory {
    /**
     * Creates rule of suitable class from text string.
     * It returns null if the line is empty or if it is a comment.
     *
     * This method avoids double parsing by trying to create each rule type directly.
     *
     * @param ruleText Rule text to parse.
     * @param filterListId List id.
     * @param ruleIndex Line start index in the source filter list; it will be used to find the original rule text
     * in the filtering log when a rule is applied. Default value is {@link RULE_INDEX_NONE} which means that
     * the rule does not have source index.
     * @param parseHostRules Whether to parse host rules. Default is true.
     *
     * @returns IRule object or null.
     *
     * @throws Error on rule creation error.
     */
    public static createRule(
        ruleText: string,
        filterListId: number,
        ruleIndex = RULE_INDEX_NONE,
        parseHostRules = true,
    ): IRule | null {
        // Check if it's empty or whitespace
        const trimmed = ruleText.trim();
        if (!trimmed) {
            return null;
        }

        // Check if it's a comment (starts with !)
        // Note: # is NOT a comment marker - it's used for cosmetic rules like ##.banner
        if (trimmed.startsWith('!')) {
            return null;
        }

        // Try to parse as cosmetic rule first (most specific parser)
        try {
            return new CosmeticRule(trimmed, filterListId, ruleIndex);
        } catch {
            // Not a cosmetic rule, continue
        }

        // Try to parse as host rule first if enabled (before network rule)
        // This is important because host rules can look like network rules
        if (parseHostRules) {
            try {
                return new HostRule(trimmed, filterListId, ruleIndex);
            } catch {
                // Not a host rule, continue to network rule
            }
        }

        // Try to parse as network rule
        try {
            return new NetworkRule(trimmed, filterListId, ruleIndex);
        } catch {
            // Not a network rule either
        }

        // If we get here, the rule couldn't be parsed as any known type
        return null;
    }

    /**
     * Creates allowlist rule for domain.
     *
     * @param domain Domain name.
     * @param filterListId List id.
     * @param ruleIndex Line start index in the source filter list.
     *
     * @returns Allowlist rule or null.
     */
    public static createAllowlistRule(
        domain: string,
        filterListId: number,
        ruleIndex = RULE_INDEX_NONE,
    ): null | NetworkRule {
        const node = createAllowlistRuleNode(domain);

        if (!node) {
            return null;
        }

        // Generate rule text from the node
        const ruleText = RuleGenerator.generate(node);

        return new NetworkRule(ruleText, filterListId, ruleIndex);
    }
}
