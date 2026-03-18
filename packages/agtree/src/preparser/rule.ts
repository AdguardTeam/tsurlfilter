/**
 * @file Rule preparser — top-level dispatcher.
 *
 * Uses {@link RuleClassifier} to determine the rule kind and delegates to the
 * matching comment or network preparser. Cosmetic rule preparsing is not yet
 * implemented.
 */

import { RuleClassifier, RuleKind } from './classifier';
import { CommentClassifier } from './comment/classifier';
import type { PreparserContext } from './context';
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
     *
     * @returns The {@link RuleKind} of the rule, so the caller can dispatch
     *   to the correct AST parser.
     *
     * @throws If the rule is a cosmetic rule (not yet implemented).
     */
    public static preparse(ctx: PreparserContext): RuleKind {
        const classified = RuleClassifier.classify(ctx);
        const kind = RuleClassifier.ruleKind(classified);

        switch (kind) {
            case RuleKind.Comment:
                CommentClassifier.preparse(ctx);
                return RuleKind.Comment;

            case RuleKind.Network:
                NetworkRulePreparser.preparse(ctx);
                return RuleKind.Network;

            case RuleKind.Cosmetic:
                throw new Error('Cosmetic rule parsing is not yet implemented');

            default:
                throw new Error(`Unknown rule kind: ${kind}`);
        }
    }
}
