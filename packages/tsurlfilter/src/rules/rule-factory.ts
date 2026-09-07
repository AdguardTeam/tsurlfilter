import {
    type AnyCosmeticRule,
    CosmeticRuleDataReader,
    NetworkRuleDataReader,
    NetworkRuleType,
    RuleCategory,
    RuleKind,
    RuleParserPipeline,
} from '@adguard/agtree';
import { RuleGenerator } from '@adguard/agtree/generator';
import { getErrorMessage } from '@adguard/logger';

import { logger } from '../utils/logger';

import { createAllowlistRuleNode } from './allowlist';
import { CosmeticRule } from './cosmetic-rule';
import { HostRule } from './host-rule';
import { NetworkRule } from './network-rule';
import { FILTER_LIST_ID_NONE, type IRule, RULE_INDEX_NONE } from './rule';

/**
 * Rule builder class.
 */
export class RuleFactory {
    /**
     * Shared AGTree parser pipeline instance.
     */
    private static readonly PARSER = new RuleParserPipeline();

    /**
     * Pre-allocated, immutable option variants (host × htmlBodies).
     */
    private static readonly OPTS = {
        ff: Object.freeze({ parseHostRules: false, parseHtmlFilteringRuleBodies: false }),
        ft: Object.freeze({ parseHostRules: false, parseHtmlFilteringRuleBodies: true }),
        tf: Object.freeze({ parseHostRules: true, parseHtmlFilteringRuleBodies: false }),
        tt: Object.freeze({ parseHostRules: true, parseHtmlFilteringRuleBodies: true }),
    } as const;

    /**
     * Picks a pre-allocated option variant for the given flags, avoiding a
     * fresh options object allocation on every `createRule` call.
     *
     * @param parseHostRules Whether to parse host rules.
     * @param parseHtmlFilteringRuleBodies Whether to parse HTML filtering rule bodies.
     *
     * @returns The immutable options variant.
     */
    private static pickOpts(
        parseHostRules: boolean,
        parseHtmlFilteringRuleBodies: boolean,
    ): Readonly<{ parseHostRules: boolean; parseHtmlFilteringRuleBodies: boolean }> {
        if (parseHostRules) {
            return parseHtmlFilteringRuleBodies ? RuleFactory.OPTS.tt : RuleFactory.OPTS.tf;
        }
        return parseHtmlFilteringRuleBodies ? RuleFactory.OPTS.ft : RuleFactory.OPTS.ff;
    }

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
     * @param parseHtmlFilteringRuleBodies Whether to parse HTML filtering rule bodies. Default is false.
     *
     * @returns IRule object or null.
     */
    public static createRule(
        ruleText: string,
        filterListId: number = FILTER_LIST_ID_NONE,
        ruleIndex = RULE_INDEX_NONE,
        parseHostRules = true,
        parseHtmlFilteringRuleBodies = false,
    ): IRule | null {
        try {
            const { kind, isHostCandidate, ctx } = RuleFactory.PARSER.parseStructural(
                ruleText,
                RuleFactory.pickOpts(parseHostRules, parseHtmlFilteringRuleBodies),
            );

            switch (kind) {
                case RuleKind.Comment:
                    return null;

                case RuleKind.Network: {
                    if (isHostCandidate) {
                        // Retained AST path for host candidates (no structural host layout),
                        // built from the already-populated context without re-parsing.
                        const node = RuleFactory.PARSER.parseFromCurrentCtx(
                            ruleText,
                            kind,
                            RuleFactory.pickOpts(parseHostRules, parseHtmlFilteringRuleBodies),
                        );

                        if (node.category !== RuleCategory.Network) {
                            return null;
                        }

                        if (node.type === NetworkRuleType.HostRule) {
                            if (!parseHostRules) {
                                return null;
                            }

                            return new HostRule(ruleText, filterListId, ruleIndex, node);
                        }

                        return new NetworkRule(ruleText, filterListId, ruleIndex, node);
                    }

                    const nr = new NetworkRuleDataReader(ctx, 0);
                    return NetworkRule.createFromReader(nr, ruleText, filterListId, ruleIndex);
                }

                case RuleKind.Cosmetic: {
                    const cr = new CosmeticRuleDataReader(ctx, 0);

                    if (cr.hasModifiers || !CosmeticRule.supportsBinaryPath(cr)) {
                        // Retained AST path for `[$...]`/uBO-modifier and
                        // non-binary cosmetic rules, built from the
                        // already-populated context without re-parsing.
                        const node = RuleFactory.PARSER.parseFromCurrentCtx(
                            ruleText,
                            kind,
                            RuleFactory.pickOpts(parseHostRules, parseHtmlFilteringRuleBodies),
                        );

                        return new CosmeticRule(
                            ruleText,
                            filterListId,
                            ruleIndex,
                            node as AnyCosmeticRule,
                        );
                    }

                    return CosmeticRule.createFromReader(cr, ruleText, filterListId, ruleIndex);
                }

                default:
                    // should not happen in normal operation
                    return null;
            }
        } catch (e) {
            logger.debug(`[tsurl.RuleFactory.createRule]: failed to create rule from text: ${ruleText}, got ${getErrorMessage(e)}`);
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

        // Generate rule text from the node
        const ruleText = RuleGenerator.generate(node);

        return new NetworkRule(ruleText, filterListId, ruleIndex);
    }
}
