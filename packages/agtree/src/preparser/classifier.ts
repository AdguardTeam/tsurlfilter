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
 *   4. Otherwise                           → Network
 */

import { TokenType } from '../tokenizer/token-types';
import type { PreparserContext } from './context';
import { skipWs } from './context';
import {
    type CosmeticSepKind,
    cosmeticSepIndex,
    cosmeticSepKind,
    findCosmeticSeparator,
} from './cosmetic-separator';

export { CosmeticSepKind } from './cosmetic-separator';

export const enum RuleKind {
    Network = 0,
    Comment = 1,
    Cosmetic = 2,
}

/**
 * Bit layout of the packed classify result (32-bit signed int):
 *
 * ```
 * [31..28]  RuleKind          (4 bits, values 0–2)
 * [27..24]  CosmeticSepKind   (4 bits, values 0–12)
 * [23.. 0]  sep token index   (24 bits, max 16 M tokens)
 * ```
 */
const RULE_KIND_SHIFT = 28;
const COSM_KIND_SHIFT = 24;
const SEP_IDX_MASK = 0x00ff_ffff;

/**
 * Zero-allocation rule type classifier.
 *
 * Call `classify` on an initialized {@link PreparserContext} to get a
 * packed result number. Use the static unpack helpers to read back the fields.
 */
export class RuleClassifier {
    /**
     * Classifies a tokenized rule.
     *
     * @param ctx Preparser context (tokenizer output must be loaded).
     * @returns Packed classification result — use `ruleKind`,
     *   `cosmeticSepKind`, and `cosmeticSepIndex` to unpack.
     */
    public static classify(ctx: PreparserContext): number {
        const { types, tokenCount } = ctx;

        const ti = skipWs(ctx, 0);

        // 1. !-comment
        if (ti < tokenCount && types[ti] === TokenType.ExclamationMark) {
            return RuleClassifier.pack(RuleKind.Comment, 0, 0);
        }

        // 2. Cosmetic separator scan (must happen before the #-comment check so
        //    that ## / #@# / … are correctly classified as cosmetic, not comment)
        const sep = findCosmeticSeparator(types, tokenCount);

        if (sep !== -1) {
            return RuleClassifier.pack(RuleKind.Cosmetic, cosmeticSepKind(sep), cosmeticSepIndex(sep));
        }

        // 3. #-comment (host-style; ## would have been caught above)
        if (ti < tokenCount && types[ti] === TokenType.HashMark) {
            return RuleClassifier.pack(RuleKind.Comment, 0, 0);
        }

        // 4. Network (default)
        return RuleClassifier.pack(RuleKind.Network, 0, 0);
    }

    /**
     * Extracts the {@link RuleKind} from a packed classify result.
     *
     * @param result Packed result from `classify`.
     * @returns The rule kind.
     */
    public static ruleKind(result: number): RuleKind {
        return (result >>> RULE_KIND_SHIFT) as RuleKind;
    }

    /**
     * Extracts the {@link CosmeticSepKind} from a packed classify result.
     * Returns `CosmeticSepKind.None` for non-cosmetic rules.
     *
     * @param result Packed result from `classify`.
     * @returns The cosmetic separator kind.
     */
    public static cosmeticSepKind(result: number): CosmeticSepKind {
        return ((result >>> COSM_KIND_SHIFT) & 0xf) as CosmeticSepKind;
    }

    /**
     * Extracts the cosmetic separator token index from a packed classify result.
     * Returns `0` for non-cosmetic rules.
     *
     * @param result Packed result from `classify`.
     * @returns The token index of the first token of the cosmetic separator.
     */
    public static cosmeticSepIndex(result: number): number {
        return result & SEP_IDX_MASK;
    }

    /**
     * Packs a classification result.
     *
     * @param ruleKind The rule kind.
     * @param sepKind The cosmetic separator kind.
     * @param sepIdx The cosmetic separator token index.
     * @returns The packed result.
     */
    private static pack(ruleKind: RuleKind, sepKind: number, sepIdx: number): number {
        return (ruleKind << RULE_KIND_SHIFT) | (sepKind << COSM_KIND_SHIFT) | (sepIdx & SEP_IDX_MASK);
    }
}
