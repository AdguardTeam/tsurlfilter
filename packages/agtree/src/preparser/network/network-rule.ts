/* eslint-disable no-bitwise */
/* eslint-disable no-param-reassign */

/**
 * @file Network rule preparser.
 *
 * The preparser fills a reusable Int32Array with structural indices into
 * the source string. No strings are allocated during preparsing.
 *
 * ## Network Rule Data Layout (Int32Array)
 *
 * Header fields (NR_HEADER_SIZE = 5):
 *   [0] flags           - Bit flags (FLAG_EXCEPTION, etc.)
 *   [1] patternStart    - Source index where pattern begins
 *   [2] patternEnd      - Source index where pattern ends (exclusive)
 *   [3] separatorIndex  - Source index of the '$' separator, or NO_VALUE (-1)
 *   [4] modifierCount   - Number of modifiers parsed
 *
 * Modifier records (MOD_STRIDE = 5 each, starting at offset NR_HEADER_SIZE):
 *   [+0] nameStart      - Source index where modifier name begins
 *   [+1] nameEnd        - Source index where modifier name ends (exclusive)
 *   [+2] flags          - Modifier flags (MOD_FLAG_NEGATED, etc.)
 *   [+3] valueStart     - Source index where value begins, or NO_VALUE (-1)
 *   [+4] valueEnd       - Source index where value ends (exclusive), or NO_VALUE (-1)
 */

import { TokenType } from '../../tokenizer/token-types';
import type { PreparserContext } from '../context';
import { regionEquals, tokenStart, skipWs } from '../context';
import { isPotentialNetModifier } from '../misc/shared';
import { ModifierListPreparser } from '../misc/modifier-list';
import {
    NR_FLAGS,
    NR_PATTERN_START,
    NR_PATTERN_END,
    NR_SEPARATOR_INDEX,
    NR_MODIFIER_COUNT,
    NR_HEADER_SIZE,
    FLAG_EXCEPTION,
    MOD_STRIDE,
    NO_VALUE,
} from './constants';

/**
 * Re-export constants for convenience.
 *
 * Constants are defined in `constants.ts` (not here) to avoid circular dependencies:
 * - `network-rule.ts` imports `ModifierListPreparser` from `misc/modifier-list.ts`
 * - `modifier.ts` needs `NR_HEADER_SIZE` to calculate modifier offsets
 * - `network-rule.ts` needs `MOD_STRIDE` to allocate buffer capacity
 *
 * Having constants in a separate dependency-free file allows all preparsers to
 * safely import the shared buffer layout without creating cycles.
 */
export {
    NR_FLAGS,
    NR_PATTERN_START,
    NR_PATTERN_END,
    NR_SEPARATOR_INDEX,
    NR_MODIFIER_COUNT,
    NR_HEADER_SIZE,
    FLAG_EXCEPTION,
    MOD_STRIDE,
    MOD_NAME_START,
    MOD_NAME_END,
    MOD_FLAGS,
    MOD_VALUE_START,
    MOD_VALUE_END,
    MOD_FLAG_NEGATED,
    NO_VALUE,
} from './constants';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Result Type
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Reusable result structure for network rule preparsing.
 *
 * **IMPORTANT**: The `data` buffer is overwritten on each call.
 * Same reuse semantics as TokenizeResult.
 */
export type NetworkRulePreparseResult = {
    /**
     * Reusable buffer storing structural data (mutated in-place).
     */
    data: Int32Array;

    /**
     * 0 = success, 1 = overflow (too many modifiers for buffer capacity).
     */
    status: 0 | 1;
};

/**
 * Creates a pre-allocated NetworkRulePreparseResult.
 *
 * @param modifierCapacity - Maximum number of modifiers supported (default: 64).
 * @returns Pre-allocated result structure ready for reuse.
 */
export function createNetworkRulePreparseResult(modifierCapacity = 64): NetworkRulePreparseResult {
    return {
        data: new Int32Array(NR_HEADER_SIZE + modifierCapacity * MOD_STRIDE),
        status: 0,
    };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Network Rule Preparser
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Preparser for network rules.
 *
 * Top of the preparser chain. Delegates to
 * {@link ModifierListPreparser} → modifier preparser → value preparser.
 */
export class NetworkRulePreparser {
    /**
     * Returns `true` if the preparsed rule is an exception rule (`@@`).
     *
     * @param data Preparsed data buffer.
     * @returns Whether the rule is an exception.
     */
    public static isException(data: Int32Array): boolean {
        return (data[NR_FLAGS] & FLAG_EXCEPTION) !== 0;
    }

    /**
     * Returns `true` if the preparsed rule has a modifier separator `$`.
     *
     * @param data Preparsed data buffer.
     * @returns Whether a separator was found.
     */
    public static hasSeparator(data: Int32Array): boolean {
        return data[NR_SEPARATOR_INDEX] !== NO_VALUE;
    }

    /**
     * Returns the source index where the pattern starts.
     *
     * @param data Preparsed data buffer.
     * @returns Source start index.
     */
    public static getPatternStart(data: Int32Array): number {
        return data[NR_PATTERN_START];
    }

    /**
     * Returns the source index where the pattern ends (exclusive).
     *
     * @param data Preparsed data buffer.
     * @returns Source end index (exclusive).
     */
    public static getPatternEnd(data: Int32Array): number {
        return data[NR_PATTERN_END];
    }

    /**
     * Returns the source index of the `$` separator, or `NO_VALUE` if none.
     *
     * @param data Preparsed data buffer.
     * @returns Separator source index or `NO_VALUE`.
     */
    public static getSeparatorIndex(data: Int32Array): number {
        return data[NR_SEPARATOR_INDEX];
    }

    /**
     * Checks whether the pattern equals a given string, without allocation.
     *
     * @param source Original source string.
     * @param data Preparsed data buffer.
     * @param target String to compare against.
     * @returns `true` if the pattern matches the target exactly.
     */
    public static patternEquals(source: string, data: Int32Array, target: string): boolean {
        return regionEquals(source, data[NR_PATTERN_START], data[NR_PATTERN_END], target);
    }

    /**
     * Extracts the pattern as a string from the source.
     *
     * @param source Original source string.
     * @param data Preparsed data buffer.
     * @returns Pattern substring.
     */
    public static getPattern(source: string, data: Int32Array): string {
        return source.slice(data[NR_PATTERN_START], data[NR_PATTERN_END]);
    }

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
