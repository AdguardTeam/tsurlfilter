/* eslint-disable no-bitwise */
/* eslint-disable no-param-reassign */

/**
 * @file Network rule preparser — top of the preparser chain.
 *
 * Identifies the exception marker (@@), pattern bounds, separator ($),
 * and delegates modifier list parsing to {@link ModifierListPreparser}.
 */

import { TokenType } from '../tokenizer/token-types';
import type { PreparserContext } from './context';
import { tokenStart, skipWs } from './context';
import {
    NR_FLAGS,
    NR_PATTERN_START,
    NR_PATTERN_END,
    NR_SEPARATOR_INDEX,
    NR_MODIFIER_COUNT,
    FLAG_EXCEPTION,
    NO_VALUE,
} from './types';
import { isPotentialNetModifier } from './shared';
import { ModifierListPreparser } from './modifier-list';

/**
 * Preparser for network rules.
 *
 * Top of the preparser chain. Delegates to
 * {@link ModifierListPreparser} → {@link ModifierPreparser} → {@link ValuePreparser}.
 */
export class NetworkRulePreparser {
    /**
     * Preparses a network rule from tokenizer output.
     *
     * Fills `ctx.data` (Int32Array) with structural indices into the source
     * string. **No strings are allocated.**
     *
     * @param ctx Preparser context (must be initialized via `initPreparserContext`).
     */
    public static preparse(ctx: PreparserContext): void {
        const { types, ends, tokenCount } = ctx;
        const d = ctx.data;

        let ti = 0;
        let flags = 0;

        ti = skipWs(ctx, ti);

        // Check for @@ exception marker
        if (
            ti + 1 < tokenCount
            && types[ti] === TokenType.AtSign
            && types[ti + 1] === TokenType.AtSign
        ) {
            flags |= FLAG_EXCEPTION;
            ti += 2;
        }

        // Pattern starts here (source index)
        const patternStartIdx = tokenStart(ctx, ti);

        // Find the separator $
        const sepTi = NetworkRulePreparser.findNetSeparator(ctx, ti);

        let patternEndIdx: number;
        let separatorSourceIdx: number;

        if (sepTi === -1) {
            patternEndIdx = tokenCount > 0
                ? ends[tokenCount - 1]
                : patternStartIdx;
            separatorSourceIdx = NO_VALUE;
        } else {
            patternEndIdx = sepTi > ti
                ? tokenStart(ctx, sepTi)
                : patternStartIdx;
            separatorSourceIdx = tokenStart(ctx, sepTi);
        }

        d[NR_FLAGS] = flags;
        d[NR_PATTERN_START] = patternStartIdx;
        d[NR_PATTERN_END] = patternEndIdx;
        d[NR_SEPARATOR_INDEX] = separatorSourceIdx;

        // Parse modifiers (if separator found)
        let modCount = 0;

        if (sepTi !== -1) {
            modCount = ModifierListPreparser.preparse(ctx, sepTi + 1);
        }

        d[NR_MODIFIER_COUNT] = modCount;
    }

    /**
     * Find network separator ($) scanning backwards using lastIndexOf.
     *
     * @param ctx Preparser context.
     * @param searchStart First token index to consider.
     * @returns Token index of the separator, or -1 if not found.
     */
    private static findNetSeparator(ctx: PreparserContext, searchStart: number): number {
        const { types, tokenCount } = ctx;
        let i = tokenCount;

        while (i > searchStart) {
            i = types.lastIndexOf(TokenType.DollarSign, i - 1);

            if (i === -1 || i < searchStart) {
                break;
            }

            if (isPotentialNetModifier(ctx, i + 1)) {
                return i;
            }
        }

        return -1;
    }
}
