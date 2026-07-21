/* eslint-disable no-bitwise */
/* eslint-disable no-param-reassign */

/**
 * @file Modifier parser.
 *
 * Parses one modifier: `[~]? <ident> [= <value>]?`
 * Writes name bounds, negation flag, and value bounds to the data buffer.
 * Delegates value parsing to {@link ValueParser}.
 */

import { TokenType } from '../../tokenizer/token-types';
import type { ParserContext } from '../context';
import {
    regionEquals,
    skipUntil,
    skipWs,
    tokenStart,
} from '../context';
import {
    MOD_KIND_REGEX,
    MOD_KIND_UNKNOWN,
    MODIFIER_FIELD_FLAGS,
    MODIFIER_FIELD_NAME_END,
    MODIFIER_FIELD_NAME_START,
    MODIFIER_FIELD_VALUE_END,
    MODIFIER_FIELD_VALUE_START,
    MODIFIER_FLAG_NEGATED,
    MODIFIER_RECORD_STRIDE,
    MODIFIER_VALUE_KIND_SHIFT,
    NO_VALUE,
    NR_MODIFIER_RECORDS_OFFSET,
} from '../network/constants';
import type { RecordParser } from '../types';

import { getModifierValueKind } from './modifier-kind';
import { isRegexLiteral } from './regex-literal';
import { ValueParser } from './value';

type ModifierBounds = { nameStart: number; nameEnd: number; valueStart: number; valueEnd: number };

/**
 * Parser for a single modifier.
 *
 * Delegates value parsing to {@link ValueParser}.
 */
export class ModifierParser implements RecordParser {
    /**
     * Minimum number of `ctx.data` slots needed for a single modifier record.
     */
    public static readonly MIN_DATA_SLOTS = NR_MODIFIER_RECORDS_OFFSET + MODIFIER_RECORD_STRIDE;

    /**
     * Returns `true` if the modifier at `idx` is negated (`~`).
     *
     * @param data Preparsed data buffer.
     * @param idx Modifier index (0-based).
     *
     * @returns Whether the modifier is negated.
     */
    public static isNegated(data: Int32Array, idx: number): boolean {
        const base = NR_MODIFIER_RECORDS_OFFSET + idx * MODIFIER_RECORD_STRIDE;
        return (data[base + MODIFIER_FIELD_FLAGS] & MODIFIER_FLAG_NEGATED) !== 0;
    }

    /**
     * Returns `true` if the modifier at `idx` has a value (i.e. `name=value`).
     *
     * @param data Preparsed data buffer.
     * @param idx Modifier index (0-based).
     *
     * @returns Whether the modifier has a value.
     */
    public static hasValue(data: Int32Array, idx: number): boolean {
        const base = NR_MODIFIER_RECORDS_OFFSET + idx * MODIFIER_RECORD_STRIDE;
        return data[base + MODIFIER_FIELD_VALUE_START] !== NO_VALUE;
    }

    /**
     * Checks whether the modifier name at `idx` equals a given string,
     * without allocation.
     *
     * @param source Original source string.
     * @param data Preparsed data buffer.
     * @param idx Modifier index (0-based).
     * @param name Name string to compare against.
     *
     * @returns `true` if the modifier name matches.
     */
    public static nameEquals(source: string, data: Int32Array, idx: number, name: string): boolean {
        const base = NR_MODIFIER_RECORDS_OFFSET + idx * MODIFIER_RECORD_STRIDE;
        return regionEquals(source, data[base + MODIFIER_FIELD_NAME_START], data[base + MODIFIER_FIELD_NAME_END], name);
    }

    /**
     * Extracts the modifier name at `idx` as a string.
     *
     * @param source Original source string.
     * @param data Preparsed data buffer.
     * @param idx Modifier index (0-based).
     *
     * @returns Modifier name substring.
     */
    public static getName(source: string, data: Int32Array, idx: number): string {
        const base = NR_MODIFIER_RECORDS_OFFSET + idx * MODIFIER_RECORD_STRIDE;
        return source.slice(data[base + MODIFIER_FIELD_NAME_START], data[base + MODIFIER_FIELD_NAME_END]);
    }

    /**
     * Extracts the modifier value at `idx` as a string, or `null` if no value.
     *
     * @param source Original source string.
     * @param data Preparsed data buffer.
     * @param idx Modifier index (0-based).
     *
     * @returns Modifier value substring or `null`.
     */
    public static getValue(source: string, data: Int32Array, idx: number): string | null {
        const base = NR_MODIFIER_RECORDS_OFFSET + idx * MODIFIER_RECORD_STRIDE;
        const vs = data[base + MODIFIER_FIELD_VALUE_START];

        if (vs === NO_VALUE) {
            return null;
        }

        return source.slice(vs, data[base + MODIFIER_FIELD_VALUE_END]);
    }

    /**
     * Returns the name and value bounds for the modifier at `idx`
     * as source indices (zero allocation, no strings).
     *
     * @param data Preparsed data buffer.
     * @param idx Modifier index (0-based).
     *
     * @returns Object with nameStart, nameEnd, valueStart, valueEnd.
     */
    public static getBounds(data: Int32Array, idx: number): ModifierBounds {
        const base = NR_MODIFIER_RECORDS_OFFSET + idx * MODIFIER_RECORD_STRIDE;
        return {
            nameStart: data[base + MODIFIER_FIELD_NAME_START],
            nameEnd: data[base + MODIFIER_FIELD_NAME_END],
            valueStart: data[base + MODIFIER_FIELD_VALUE_START],
            valueEnd: data[base + MODIFIER_FIELD_VALUE_END],
        };
    }

    /**
     * Preparse a single modifier starting at token `ti`.
     * Writes to the record at `modIndex`.
     *
     * @param ctx Parser context.
     * @param ti Token index where the modifier starts.
     * @param modIndex Modifier index (0-based) for writing the record.
     * @param recordsOffset Buffer offset where modifier records should be written (defaults to network offset).
     * @param endTi Exclusive token index where the modifier list ends. Defaults to `ctx.tokenCount`.
     *
     * @returns Token index after the modifier, or -1 if no modifier found.
     */
    public static parse(
        ctx: ParserContext,
        ti: number,
        modIndex: number,
        recordsOffset: number = NR_MODIFIER_RECORDS_OFFSET,
        endTi: number = ctx.tokenCount,
    ): number {
        const { types } = ctx;
        const tokenCount = endTi;
        const modBase = recordsOffset + modIndex * MODIFIER_RECORD_STRIDE;
        let modFlags = 0;

        // Skip whitespace before modifier
        ti = skipWs(ctx, ti);
        if (ti >= tokenCount) {
            return -1;
        }

        // Check for negation (Tilde: ~)
        if (types[ti] === TokenType.Tilde) {
            modFlags |= MODIFIER_FLAG_NEGATED;
            ti += 1;
            ti = skipWs(ctx, ti);
        }

        // Modifier name — expect identifier starting with Letter or Digit.
        // Digit-leading names are valid for uBO aliases like `1p` / `3p`.
        if (ti >= tokenCount || (types[ti] !== TokenType.Letter && types[ti] !== TokenType.Digit)) {
            return -1;
        }

        const nameStartIdx = tokenStart(ctx, ti);
        // Modifier names are [A-Za-z][A-Za-z0-9-]* — single range check covers
        // Letter (0) | Hyphen (1) | Digit (2): types[ti] <= TokenType.Digit
        while (ti < tokenCount && types[ti] <= TokenType.Digit) {
            ti += 1;
        }
        const nameEndIdx = ctx.ends[ti - 1];

        // Skip whitespace after name
        ti = skipWs(ctx, ti);

        // Check what follows the name
        let valStart = NO_VALUE;
        let valEnd = NO_VALUE;
        let valTokenStartTi = tokenCount; // Token index at start of value

        if (ti >= tokenCount || types[ti] === TokenType.Comma) {
            // No value — modifier is complete
        } else if (types[ti] === TokenType.EqualsSign) {
            ti += 1; // consume =
            ti = skipWs(ctx, ti);

            // Value starts here
            valTokenStartTi = ti;
            const valTokenStart = ti;
            valStart = ti < tokenCount
                ? tokenStart(ctx, ti)
                : ctx.ends[ti - 1];

            // Dispatch to value parser based on modifier name
            let valEndTi: number;

            if (ValueParser.isReplaceName(ctx.source, nameStartIdx, nameEndIdx)) {
                valEndTi = ValueParser.parseReplace(ctx, ti, tokenCount);
            } else {
                valEndTi = ValueParser.parseStandard(ctx, ti, tokenCount);
            }

            valEnd = valEndTi > valTokenStart ? ctx.ends[valEndTi - 1] : valStart;
            ti = valEndTi;
        } else {
            // Unexpected token after name — skip to next comma for robustness
            ti = skipUntil(ctx, ti, tokenCount, TokenType.Comma);
        }

        // Determine value kind from modifier name and value format
        let valueKind = valStart !== NO_VALUE
            ? getModifierValueKind(ctx.source, nameStartIdx, nameEndIdx)
            : MOD_KIND_UNKNOWN;

        // If name-based kind is unknown but value looks like a regex literal,
        // delegate detection to the shared isRegexLiteral helper.
        if (valueKind === MOD_KIND_UNKNOWN && valStart !== NO_VALUE
            && isRegexLiteral(types, valTokenStartTi, ti)) {
            valueKind = MOD_KIND_REGEX;
        }

        modFlags |= (valueKind << MODIFIER_VALUE_KIND_SHIFT);

        ctx.data[modBase + MODIFIER_FIELD_NAME_START] = nameStartIdx;
        ctx.data[modBase + MODIFIER_FIELD_NAME_END] = nameEndIdx;
        ctx.data[modBase + MODIFIER_FIELD_FLAGS] = modFlags;
        ctx.data[modBase + MODIFIER_FIELD_VALUE_START] = valStart;
        ctx.data[modBase + MODIFIER_FIELD_VALUE_END] = valEnd;

        return ti;
    }
}
