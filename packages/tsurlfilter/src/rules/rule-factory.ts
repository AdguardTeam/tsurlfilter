import {
    type AnyRule,
    NetworkRuleType,
    RuleCategory,
    RuleGenerator,
} from '@adguard/agtree';

import { CosmeticRule } from './cosmetic-rule';
import { NetworkRule } from './network-rule';
import { RULE_INDEX_NONE, type IRule } from './rule';
import { HostRule } from './host-rule';
import { logger } from '../utils/logger';
import { getErrorMessage } from '../common/error';
import { createAllowlistRuleNode } from './allowlist';

/**
 * Rule builder class
 */
export class RuleFactory {
    /**
     * Creates rule of suitable class from text string
     * It returns null if the line is empty or if it is a comment
     *
     * TODO: Pack `ignore*` parameters and `silent` into one object with flags.
     *
     * @param node Rule node
     * @param filterListId list id
     * @param ruleIndex line start index in the source filter list; it will be used to find the original rule text
     * in the filtering log when a rule is applied. Default value is {@link RULE_INDEX_NONE} which means that
     * the rule does not have source index
     * @param ignoreNetwork do not create network rules
     * @param ignoreCosmetic do not create cosmetic rules
     * @param ignoreHost do not create host rules
     * @param silent Log the error for `true`, otherwise throw an exception on
     * a rule creation
     *
     * @throws Error when `silent` flag is passed as false on rule creation error.
     *
     * @return IRule object or null
     */
    public static createRule(
        node: AnyRule,
        filterListId: number,
        ruleIndex = RULE_INDEX_NONE,
        ignoreNetwork = false,
        ignoreCosmetic = false,
        ignoreHost = true,
        silent = true,
    ): IRule | null {
        try {
            switch (node.category) {
                case RuleCategory.Invalid:
                case RuleCategory.Empty:
                case RuleCategory.Comment:
                    return null;

                case RuleCategory.Cosmetic:
                    if (ignoreCosmetic) {
                        return null;
                    }

                    return new CosmeticRule(node, filterListId, ruleIndex);

                case RuleCategory.Network:
                    if (node.type === NetworkRuleType.HostRule) {
                        if (ignoreHost) {
                            return null;
                        }

                        return new HostRule(node, filterListId, ruleIndex);
                    }

                    if (ignoreNetwork) {
                        return null;
                    }

                    return new NetworkRule(node, filterListId, ruleIndex);

                default:
                    // should not happen in normal operation
                    return null;
            }
        } catch (e) {
            const ruleText = RuleGenerator.generate(node);
            const msg = `"${getErrorMessage(e)}" in the rule: "${ruleText}"`;
            if (silent) {
                logger.info(`Error: ${msg}`);
            } else {
                throw new Error(msg);
            }
        }

        return null;
    }

    /**
     * Creates allowlist rule for domain.
     *
     * @param domain Domain name.
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
