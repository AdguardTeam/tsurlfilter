/* eslint-disable no-bitwise */
/* eslint-disable no-param-reassign */

/**
 * @file Network rule parser.
 *
 * The parser fills a reusable Int32Array with structural indices into
 * the source string. No strings are allocated during preparsing.
 *
 * ## Network Rule Data Layout (Int32Array)
 *
 * Header fields (NR_HEADER_SIZE = 5):
 *   [0] flags           - Bit flags (FLAG_EXCEPTION, etc.)
 *   [1] patternStart    - Source index where pattern begins
 *   [2] patternEnd      - Source index where pattern ends (exclusive)
 *   [3] separatorIndex  - Source index of the '$' separator, or NO_VALUE (-1)
 *   [4] modifierCount   - Number of modifiers parsed.
 *
 * Modifier records (MOD_STRIDE = 5 each, starting at offset NR_HEADER_SIZE):
 *   [+0] nameStart      - Source index where modifier name begins
 *   [+1] nameEnd        - Source index where modifier name ends (exclusive)
 *   [+2] flags          - Modifier flags (MOD_FLAG_NEGATED, etc.)
 *   [+3] valueStart     - Source index where value begins, or NO_VALUE (-1)
 *   [+4] valueEnd       - Source index where value ends (exclusive), or NO_VALUE (-1).
 */

import { TokenType } from '../../tokenizer/token-types';
import type { ParserContext } from '../context';
import { regionEquals, skipWs, tokenStart } from '../context';
import { ModifierListParser } from '../misc/modifier-list';
import { isRegexLiteral } from '../misc/regex-literal';
import { isPotentialNetModifier } from '../misc/shared';
import type { StructuralParser } from '../types';

import {
    NO_VALUE,
    NR_FLAG_EXCEPTION,
    NR_FLAG_PATTERN_REGEX,
    NR_FLAGS_OFFSET,
    NR_MIN_DATA_SLOTS,
    NR_MODIFIER_COUNT_OFFSET,
    NR_MODIFIER_RECORDS_OFFSET,
    NR_PATTERN_END_OFFSET,
    NR_PATTERN_START_OFFSET,
    NR_SEPARATOR_INDEX_OFFSET,
} from './constants';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Result Type
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Network Rule Parser
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Parser for network rules.
 *
 * Top of the parser chain. Delegates to
 * {@link ModifierListParser} → modifier parser → value parser.
 */
export class NetworkRuleParser implements StructuralParser {
    /**
     * Minimum `ctx.data` slots required by this parser with the default
     * modifier capacity.
     *
     * @see {@link NR_MIN_DATA_SLOTS}
     */
    public static readonly MIN_DATA_SLOTS = NR_MIN_DATA_SLOTS;

    /**
     * Returns `true` if the parsed rule is an exception rule (`@@`).
     *
     * @param data Preparsed data buffer.
     *
     * @returns Whether the rule is an exception.
     */
    public static isException(data: Int32Array): boolean {
        return (data[NR_FLAGS_OFFSET] & NR_FLAG_EXCEPTION) !== 0;
    }

    /**
     * Returns `true` if the parsed rule has a modifier separator `$`.
     *
     * @param data Preparsed data buffer.
     *
     * @returns Whether a separator was found.
     */
    public static hasSeparator(data: Int32Array): boolean {
        return data[NR_SEPARATOR_INDEX_OFFSET] !== NO_VALUE;
    }

    /**
     * Returns the source index where the pattern starts.
     *
     * @param data Preparsed data buffer.
     *
     * @returns Source start index.
     */
    public static getPatternStart(data: Int32Array): number {
        return data[NR_PATTERN_START_OFFSET];
    }

    /**
     * Returns the source index where the pattern ends (exclusive).
     *
     * @param data Preparsed data buffer.
     *
     * @returns Source end index (exclusive).
     */
    public static getPatternEnd(data: Int32Array): number {
        return data[NR_PATTERN_END_OFFSET];
    }

    /**
     * Returns the source index of the `$` separator, or `NO_VALUE` if none.
     *
     * @param data Preparsed data buffer.
     *
     * @returns Separator source index or `NO_VALUE`.
     */
    public static getSeparatorIndex(data: Int32Array): number {
        return data[NR_SEPARATOR_INDEX_OFFSET];
    }

    /**
     * Checks whether the pattern equals a given string, without allocation.
     *
     * @param source Original source string.
     * @param data Preparsed data buffer.
     * @param target String to compare against.
     *
     * @returns `true` if the pattern matches the target exactly.
     */
    public static patternEquals(source: string, data: Int32Array, target: string): boolean {
        return regionEquals(source, data[NR_PATTERN_START_OFFSET], data[NR_PATTERN_END_OFFSET], target);
    }

    /**
     * Extracts the pattern as a string from the source.
     *
     * @param source Original source string.
     * @param data Preparsed data buffer.
     *
     * @returns Pattern substring.
     */
    public static getPattern(source: string, data: Int32Array): string {
        return source.slice(data[NR_PATTERN_START_OFFSET], data[NR_PATTERN_END_OFFSET]);
    }

    /**
     * Preparses a network rule from tokenizer output.
     *
     * Fills `ctx.data` (Int32Array) with structural indices into the source
     * string. **No strings are allocated.**.
     *
     * @param ctx Parser context (must be initialized via `initParserContext`).
     * @param startTi Inclusive start token index. Defaults to 0.
     * @param endTi Exclusive end token index. Defaults to ctx.tokenCount.
     * @param dataOffset Offset within ctx.data to write output. Defaults to 0.
     */
    public static parse(ctx: ParserContext, startTi = 0, endTi = ctx.tokenCount, dataOffset = 0): void {
        const { types, ends } = ctx;
        const d = ctx.data;

        let ti = startTi;
        let flags = 0;

        ti = skipWs(ctx, ti);

        // Check for @@ exception marker
        if (
            ti + 1 < endTi
            && types[ti] === TokenType.AtSign
            && types[ti + 1] === TokenType.AtSign
        ) {
            flags |= NR_FLAG_EXCEPTION;
            ti += 2;
        }

        // Pattern starts here (source index)
        const patternStartIdx = tokenStart(ctx, ti);

        // Find the separator $
        const sepTi = NetworkRuleParser.findNetSeparator(ctx, ti, endTi);

        let patternEndIdx: number;
        let separatorSourceIdx: number;

        if (sepTi === -1) {
            patternEndIdx = endTi > startTi
                ? ends[endTi - 1]
                : patternStartIdx;
            separatorSourceIdx = NO_VALUE;
        } else {
            patternEndIdx = sepTi > ti
                ? tokenStart(ctx, sepTi)
                : patternStartIdx;
            separatorSourceIdx = tokenStart(ctx, sepTi);
        }

        d[dataOffset + NR_FLAGS_OFFSET] = flags;
        // Detect regex pattern: delegate to the shared isRegexLiteral helper.
        const patternStartTi = ti;
        const patternEndTi = sepTi !== -1 ? sepTi : endTi;
        if (isRegexLiteral(types, patternStartTi, patternEndTi)) {
            d[dataOffset + NR_FLAGS_OFFSET] = flags | NR_FLAG_PATTERN_REGEX;
        }
        d[dataOffset + NR_PATTERN_START_OFFSET] = patternStartIdx;
        d[dataOffset + NR_PATTERN_END_OFFSET] = patternEndIdx;
        d[dataOffset + NR_SEPARATOR_INDEX_OFFSET] = separatorSourceIdx;

        // Parse modifiers (if separator found)
        if (sepTi !== -1) {
            ModifierListParser.parse(ctx, sepTi + 1, dataOffset + NR_MODIFIER_RECORDS_OFFSET, dataOffset, endTi);
        } else {
            d[dataOffset + NR_MODIFIER_COUNT_OFFSET] = 0;
        }
    }

    /**
     * Find network separator ($) scanning backwards using lastIndexOf.
     *
     * @param ctx Parser context.
     * @param searchStart First token index to consider.
     * @param endTi Exclusive end token index.
     *
     * @returns Token index of the separator, or -1 if not found.
     */
    private static findNetSeparator(ctx: ParserContext, searchStart: number, endTi = ctx.tokenCount): number {
        const { types } = ctx;
        let i = endTi;

        while (i > searchStart) {
            i = types.lastIndexOf(TokenType.DollarSign, i - 1);

            if (i === -1 || i < searchStart) {
                break;
            }

            if (isPotentialNetModifier(ctx, i + 1, endTi)) {
                return i;
            }
        }

        return -1;
    }
}
