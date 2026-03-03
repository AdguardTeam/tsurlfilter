/* eslint-disable no-bitwise */
/* eslint-disable no-param-reassign */

/**
 * @file Modifier preparser.
 *
 * Parses one modifier: `[~]? <ident> [= <value>]?`
 * Writes name bounds, negation flag, and value bounds to the data buffer.
 * Delegates value parsing to {@link ValuePreparser}.
 */

import { TokenType } from '../tokenizer/token-types';
import type { PreparserContext } from './context';
import { tokenStart, skipWs, skipUntil } from './context';
import {
    NR_HEADER_SIZE,
    MOD_STRIDE,
    MOD_NAME_START,
    MOD_NAME_END,
    MOD_FLAGS,
    MOD_VALUE_START,
    MOD_VALUE_END,
    MOD_FLAG_NEGATED,
    NO_VALUE,
} from './types';
import { ValuePreparser } from './value';

/**
 * Preparser for a single modifier.
 *
 * Delegates value parsing to {@link ValuePreparser}.
 */
export class ModifierPreparser {
    /**
     * Preparse a single modifier and write its record to `ctx.data`.
     *
     * @param ctx Preparser context.
     * @param ti Token index at the start of this modifier.
     * @param modIndex Which modifier slot to write (0-based).
     * @returns Token index after this modifier (at the separator comma or end),
     *          or -1 if the token at `ti` cannot start a modifier.
     */
    public static preparse(ctx: PreparserContext, ti: number, modIndex: number): number {
        const { types, tokenCount } = ctx;
        const modBase = NR_HEADER_SIZE + modIndex * MOD_STRIDE;
        let modFlags = 0;

        // Skip whitespace before modifier
        ti = skipWs(ctx, ti);
        if (ti >= tokenCount) {
            return -1;
        }

        // Check for negation (Tilde: ~)
        if (types[ti] === TokenType.Tilde) {
            modFlags |= MOD_FLAG_NEGATED;
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

        ctx.data[modBase + MOD_NAME_START] = nameStartIdx;
        ctx.data[modBase + MOD_NAME_END] = nameEndIdx;
        ctx.data[modBase + MOD_FLAGS] = modFlags;
        ctx.data[modBase + MOD_VALUE_START] = valStart;
        ctx.data[modBase + MOD_VALUE_END] = valEnd;

        return ti;
    }
}
