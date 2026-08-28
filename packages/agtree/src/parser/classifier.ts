/* eslint-disable no-bitwise */

/**
 * @file Rule classifier.
 *
 * Classifies a tokenized rule into one of three kinds — Comment, Cosmetic, or
 * Network — without allocating any strings.
 *
 * Classification order (first match wins):
 *   1. Leading `!`                         → Comment
 *   2. Cosmetic separator in token stream  → Cosmetic
 *   3. Leading `#` (no cosmetic sep)       → Comment (host-style)
 *   4. `[…]` with no cosmetic sep          → Comment (agent)
 *   5. Otherwise                           → Network.
 */

import { TokenType } from '../tokenizer/token-types';

import type { ParserContext } from './context';
import { skipWs, skipWsBack } from './context';
import { cosmeticSepStartIndex, cosmeticSepTokenCount, findCosmeticSeparator } from './cosmetic-separator';

export const enum RuleKind {
    Network = 0,
    Comment = 1,
    Cosmetic = 2,
}

/**
 * Bit layout of the packed classify result (32-bit signed int):.
 *
 * ```
 * [31..28]  RuleKind              (4 bits, values 0–2)
 * [27..24]  sep token count       (4 bits, values 0 or 2–5)
 * [23.. 0]  sep start token index (24 bits, max 16 M tokens)
 * ```
 */
const RULE_KIND_SHIFT = 28;
const SEP_COUNT_SHIFT = 24;
const SEP_IDX_MASK = 0x00ff_ffff;

/**
 * Zero-allocation rule type classifier.
 *
 * Call `classify` on an initialized {@link ParserContext} to get a
 * packed result number. Use the static unpack helpers to read back the fields.
 */
export class RuleClassifier {
    /**
     * Classifies a tokenized rule.
     *
     * @param ctx Parser context (tokenizer output must be loaded).
     * @param startTi Inclusive start token index. Defaults to 0.
     * @param endTi Exclusive end token index. Defaults to ctx.tokenCount.
     *
     * @returns Packed classification result — use `ruleKind`,
     *   `cosmeticSepTokenCount`, and `cosmeticSepIndex` to unpack.
     */
    public static classify(ctx: ParserContext, startTi = 0, endTi = ctx.tokenCount): number {
        const { types } = ctx;

        const ti = skipWs(ctx, startTi);

        // 1. !-comment
        if (ti < endTi && types[ti] === TokenType.ExclamationMark) {
            return RuleClassifier.pack(RuleKind.Comment, 0, 0);
        }

        // 2. Cosmetic separator scan (must happen before the #-comment check so
        //    that ## / #@# / … are correctly classified as cosmetic, not comment)
        const sep = findCosmeticSeparator(types, endTi, startTi);

        if (sep !== -1) {
            // Host-style (#-started) rules require a valid selector after the
            // cosmetic separator; otherwise the rule is a comment. This mirrors
            // legacy `SimpleCommentParser.isSimpleComment`, so rules like
            // `#####` are treated as comments, while `###selector` stays cosmetic.
            if (types[ti] === TokenType.HashMark) {
                const afterTi = cosmeticSepStartIndex(sep) + cosmeticSepTokenCount(sep);

                const invalidSelector = afterTi >= endTi
                    || types[afterTi] === TokenType.Whitespace
                    || (types[afterTi] === TokenType.HashMark
                        && afterTi + 1 < endTi
                        && types[afterTi + 1] === TokenType.HashMark);

                if (invalidSelector) {
                    return RuleClassifier.pack(RuleKind.Comment, 0, 0);
                }
            }

            return RuleClassifier.pack(
                RuleKind.Cosmetic,
                cosmeticSepTokenCount(sep),
                cosmeticSepStartIndex(sep),
            );
        }

        // 3. #-comment (host-style; ## would have been caught above)
        if (ti < endTi && types[ti] === TokenType.HashMark) {
            return RuleClassifier.pack(RuleKind.Comment, 0, 0);
        }

        // 4. Agent comment: `[…]` — starts with `[`, last significant token is `]`
        //    Rules like `[$adg-modifier]##selector` are caught by the cosmetic check above.
        if (ti < endTi && types[ti] === TokenType.OpenSquare) {
            const last = skipWsBack(ctx, endTi - 1, ti + 1);

            if (types[last] === TokenType.CloseSquare) {
                return RuleClassifier.pack(RuleKind.Comment, 0, 0);
            }
        }

        // 5. Network (default)
        return RuleClassifier.pack(RuleKind.Network, 0, 0);
    }

    /**
     * Extracts the {@link RuleKind} from a packed classify result.
     *
     * @param result Packed result from `classify`.
     *
     * @returns The rule kind.
     */
    public static ruleKind(result: number): RuleKind {
        return (result >>> RULE_KIND_SHIFT) as RuleKind;
    }

    /**
     * Extracts the cosmetic separator token count from a packed classify result.
     * Returns `0` for non-cosmetic rules.
     *
     * @param result Packed result from `classify`.
     *
     * @returns Number of tokens the separator spans (0 or 2–5).
     */
    public static cosmeticSepTokenCount(result: number): number {
        return (result >>> SEP_COUNT_SHIFT) & 0xf;
    }

    /**
     * Extracts the cosmetic separator start token index from a packed classify
     * result. Returns `0` for non-cosmetic rules.
     *
     * @param result Packed result from `classify`.
     *
     * @returns The token index of the first token of the cosmetic separator.
     */
    public static cosmeticSepIndex(result: number): number {
        return result & SEP_IDX_MASK;
    }

    /**
     * Packs a classification result.
     *
     * @param ruleKind The rule kind.
     * @param sepTokCount The cosmetic separator token count.
     * @param sepIdx The cosmetic separator start token index.
     *
     * @returns The packed result.
     */
    private static pack(ruleKind: RuleKind, sepTokCount: number, sepIdx: number): number {
        return (ruleKind << RULE_KIND_SHIFT) | (sepTokCount << SEP_COUNT_SHIFT) | (sepIdx & SEP_IDX_MASK);
    }
}
