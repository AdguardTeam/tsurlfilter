import { type AnyRule, NetworkRuleType, RuleCategory } from '@adguard/agtree';

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
     * Creates rule of suitable class from text string
     * It returns null if the line is empty or if it is a comment.
     *
     * TODO: Pack `ignore*` parameters and `silent` into one object with flags.
     *
     * @param node Rule node.
     * @param filterListId List id.
     * @param ruleIndex Line start index in the source filter list; it will be used to find the original rule text
     * in the filtering log when a rule is applied. Default value is {@link RULE_INDEX_NONE} which means that
     * the rule does not have source index.
     *
     * @returns IRule object or null.
     *
     * @throws Error on rule creation error.
     */
    public static createRule(
        node: AnyRule,
        filterListId: number,
        ruleIndex = RULE_INDEX_NONE,
    ): IRule | null {
        switch (node.category) {
            case RuleCategory.Invalid:
            case RuleCategory.Empty:
            case RuleCategory.Comment:
                return null;

            case RuleCategory.Cosmetic:
                return new CosmeticRule(node, filterListId, ruleIndex);

            case RuleCategory.Network:
                if (node.type === NetworkRuleType.HostRule) {
                    return new HostRule(node, filterListId, ruleIndex);
                }

                return new NetworkRule(node, filterListId, ruleIndex);

            default:
                // should not happen in normal operation
                throw new Error('Unsupported rule category');
        }
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

        return new NetworkRule(node, filterListId, ruleIndex);
    }
}
