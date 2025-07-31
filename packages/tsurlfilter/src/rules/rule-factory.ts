import { type AnyRule, NetworkRuleType, RuleCategory } from '@adguard/agtree';
import { RuleGenerator } from '@adguard/agtree/generator';

import { getErrorMessage } from '../common/error';
import { logger } from '../utils/logger';

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
     * @param ignoreNetwork Do not create network rules.
     * @param ignoreCosmetic Do not create cosmetic rules.
     * @param ignoreHost Do not create host rules.
     * @param silent Log the error for `true`, otherwise throw an exception on
     * a rule creation.
     *
     * @returns IRule object or null.
     *
     * @throws Error when `silent` flag is passed as false on rule creation error.
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
            let msg = `"${getErrorMessage(e)}" in the rule: `;

            try {
                msg += `"${RuleGenerator.generate(node)}"`;
            } catch (generateError) {
                msg += `"${JSON.stringify(node)}" (generate error: ${getErrorMessage(generateError)})`;
            }

            if (silent) {
                logger.debug(`[tsurl.RuleFactory.createRule]: error: ${msg}`);
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
