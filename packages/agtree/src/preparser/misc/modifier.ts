/* eslint-disable no-bitwise */
/* eslint-disable no-param-reassign */

/**
 * @file Modifier preparser.
 *
 * Parses one modifier: `[~]? <ident> [= <value>]?`
 * Writes name bounds, negation flag, and value bounds to the data buffer.
 * Delegates value parsing to {@link ValuePreparser}.
 */

import { TokenType } from '../../tokenizer/token-types';
import type { PreparserContext } from '../context';
import {
    regionEquals,
    skipUntil,
    skipWs,
    tokenStart,
} from '../context';
import {
    NR_MODIFIER_RECORDS_OFFSET,
    MODIFIER_RECORD_STRIDE,
    MODIFIER_FIELD_NAME_START,
    MODIFIER_FIELD_NAME_END,
    MODIFIER_FIELD_FLAGS,
    MODIFIER_FIELD_VALUE_START,
    MODIFIER_FIELD_VALUE_END,
    MODIFIER_FLAG_NEGATED,
    NO_VALUE,
} from '../network/constants';
import { ValuePreparser } from './value';

type ModifierBounds = { nameStart: number; nameEnd: number; valueStart: number; valueEnd: number };

/**
 * Preparser for a single modifier.
 *
 * Delegates value parsing to {@link ValuePreparser}.
 */
export class ModifierPreparser {
    /**
     * Returns `true` if the modifier at `idx` is negated (`~`).
     *
     * @param data Preparsed data buffer.
     * @param idx Modifier index (0-based).
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
     * Preparses a single modifier and writes its record to `ctx.data`.
     *
     * @param ctx Preparser context.
     * @param ti Token index at the start of this modifier.
     * @param modIndex Which modifier slot to write (0-based).
     * @returns Token index after this modifier (at the separator comma or end),
     *          or -1 if the token at `ti` cannot start a modifier.
     */
    public static preparse(ctx: PreparserContext, ti: number, modIndex: number): number {
        const { types, tokenCount } = ctx;
        const modBase = NR_MODIFIER_RECORDS_OFFSET + modIndex * MODIFIER_RECORD_STRIDE;
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

        // Modifier name — expect Ident token
        if (ti >= tokenCount || types[ti] !== TokenType.Ident) {
            return -1;
        }

        const nameStartIdx = tokenStart(ctx, ti);
        const nameEndIdx = ctx.ends[ti];
        ti += 1;

        // Skip whitespace after name
        ti = skipWs(ctx, ti);

        // Check what follows the name
        let valStart = NO_VALUE;
        let valEnd = NO_VALUE;

        if (ti >= tokenCount || types[ti] === TokenType.Comma) {
            // No value — modifier is complete
        } else if (types[ti] === TokenType.EqualsSign) {
            ti += 1; // consume =
            ti = skipWs(ctx, ti);

            // Value starts here
            const valTokenStart = ti;
            valStart = ti < tokenCount
                ? tokenStart(ctx, ti)
                : ctx.ends[ti - 1];

            // Dispatch to value preparser based on modifier name
            let valEndTi: number;

            if (ValuePreparser.isReplaceName(ctx.source, nameStartIdx, nameEndIdx)) {
                valEndTi = ValuePreparser.parseReplace(ctx, ti, tokenCount);
            } else {
                valEndTi = ValuePreparser.parseStandard(ctx, ti, tokenCount);
            }

            valEnd = valEndTi > valTokenStart ? ctx.ends[valEndTi - 1] : valStart;
            ti = valEndTi;
        } else {
            // Unexpected token after name — skip to next comma for robustness
            ti = skipUntil(ctx, ti, tokenCount, TokenType.Comma);
        }

        ctx.data[modBase + MODIFIER_FIELD_NAME_START] = nameStartIdx;
        ctx.data[modBase + MODIFIER_FIELD_NAME_END] = nameEndIdx;
        ctx.data[modBase + MODIFIER_FIELD_FLAGS] = modFlags;
        ctx.data[modBase + MODIFIER_FIELD_VALUE_START] = valStart;
        ctx.data[modBase + MODIFIER_FIELD_VALUE_END] = valEnd;

        return ti;
    }
}
