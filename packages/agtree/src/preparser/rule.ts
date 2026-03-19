/**
 * @file Rule preparser — top-level dispatcher.
 *
 * Uses {@link RuleClassifier} to determine the rule kind and delegates to the
 * matching comment, network, or cosmetic preparser.
 */

import { CosmeticSepKind, RuleClassifier, RuleKind } from './classifier';
import { CommentClassifier } from './comment/classifier';
import type { PreparserContext } from './context';
import { ElementHidingPreparser } from './cosmetic/element-hiding';
import { NetworkRulePreparser } from './network/network-rule';

export { RuleKind } from './classifier';

/**
 * Top-level rule preparser.
 *
 * Classifies the rule from the already-tokenized context, then runs the
 * matching preparser so that `ctx.data` is ready for AST construction.
 *
 * @example
 * ```typescript
 * tokenizeLine(source, 0, tokens);
 * initPreparserContext(ctx, source, tokens);
 * const kind = RulePreparser.preparse(ctx);
 * // ctx.data is now populated; use `kind` to pick the correct AST parser.
 * ```
 */
export class RulePreparser {
    /**
     * Classifies the rule and runs the appropriate preparser.
     *
     * @param ctx Preparser context with tokenizer output already loaded.
     * @param parseUboSpecificRules Whether to detect uBO modifiers (default true).
     *
     * @returns The {@link RuleKind} of the rule, so the caller can dispatch
     *   to the correct AST parser.
     *
     * @throws If the rule is a non-element-hiding cosmetic rule (not yet implemented).
     */
    public static preparse(ctx: PreparserContext, parseUboSpecificRules = true): RuleKind {
        const classified = RuleClassifier.classify(ctx);
        const kind = RuleClassifier.ruleKind(classified);

        switch (kind) {
            case RuleKind.Comment:
                CommentClassifier.preparse(ctx);
                return RuleKind.Comment;

            case RuleKind.Network:
                NetworkRulePreparser.preparse(ctx);
                return RuleKind.Network;

            case RuleKind.Cosmetic: {
                const sepKind = RuleClassifier.cosmeticSepKind(classified);
                // Element hiding: ##, #@#, #?#, #@?# (kinds 1-4)
                if (sepKind >= CosmeticSepKind.ElementHiding
                    && sepKind <= CosmeticSepKind.ExtendedElementHidingException) {
                    ElementHidingPreparser.preparse(ctx, classified, parseUboSpecificRules);
                    return RuleKind.Cosmetic;
                }
                // Other cosmetic types not yet implemented
                throw new Error(`Cosmetic separator kind ${sepKind} is not yet implemented in the new pipeline`);
            }

            default:
                throw new Error(`Unknown rule kind: ${kind}`);
        }
    }
}
