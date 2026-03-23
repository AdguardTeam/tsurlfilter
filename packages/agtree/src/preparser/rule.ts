/**
 * @file Rule preparser — top-level dispatcher.
 *
 * Uses {@link RuleClassifier} to determine the rule kind and delegates to the
 * matching comment, network, or cosmetic preparser.
 */

import { RuleClassifier, RuleKind } from './classifier';
import { CommentClassifier } from './comment/classifier';
import type { PreparserContext } from './context';
import { tokenStart } from './context';
import { ElementHidingPreparser } from './cosmetic/element-hiding';
import { NetworkRulePreparser } from './network/network-rule';

export { RuleKind } from './classifier';

/**
 * Checks whether the cosmetic separator starting at `sepStart` in `source`
 * is an element hiding separator (##, #@#, #?#, #@?#).
 *
 * Element hiding separators start with `#` and the character after `#`
 * (or `#@`) is `#` or `?` — never `$` or `%`.
 *
 * @param source Source string.
 * @param sepStart Source index where the separator starts.
 *
 * @returns True if the separator is element-hiding.
 */
function isElementHidingSep(source: string, sepStart: number): boolean {
    if (source.charCodeAt(sepStart) !== 0x23) {
        return false; // must start with #
    }
    const c1 = source.charCodeAt(sepStart + 1);
    // ## or #?#
    if (c1 === 0x23 || c1 === 0x3F) {
        return true;
    }
    // #@# or #@?#
    if (c1 === 0x40) {
        const c2 = source.charCodeAt(sepStart + 2);
        return c2 === 0x23 || c2 === 0x3F;
    }
    return false;
}

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
                const sepTokenIndex = RuleClassifier.cosmeticSepIndex(classified);
                const sepStart = tokenStart(ctx, sepTokenIndex);

                if (isElementHidingSep(ctx.source, sepStart)) {
                    ElementHidingPreparser.preparse(ctx, classified, parseUboSpecificRules);
                    return RuleKind.Cosmetic;
                }

                // Other cosmetic types not yet implemented
                const sepTokCount = RuleClassifier.cosmeticSepTokenCount(classified);
                const sepEnd = ctx.ends[sepTokenIndex + sepTokCount - 1];
                const sep = ctx.source.slice(sepStart, sepEnd);
                throw new Error(`Cosmetic separator '${sep}' is not yet implemented in the new pipeline`);
            }

            default:
                throw new Error(`Unknown rule kind: ${kind}`);
        }
    }
}
