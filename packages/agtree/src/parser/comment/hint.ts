/**
 * @file Hint comment parser.
 *
 * Handles `!+ HINT_NAME[(params)] ...` rules. Records per-hint name and
 * optional parameter bounds in `ctx.data`.
 *
 * ## Data Layout
 * [0] KIND - CommentKind.Hint
 * [1] COUNT - Number of hints
 * [2+] Per hint (stride=4): NAME_START, NAME_END, PARAMS_START, PARAMS_END
 *      PARAMS_START/PARAMS_END are -1 when the hint has no parameters.
 *
 * @see {@link https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#hints}
 */

import { TokenType } from '../../tokenizer/token-types';
import type { ParserContext } from '../context';
import { skipWs, tokenStart } from '../context';
import type { StructuralParser } from '../types';

import { CM_KIND, CommentKind } from './types';

/**
 * Buffer offset: number of hints in the rule.
 */
export const CM_HINT_COUNT_OFFSET = 1;

/**
 * Buffer offset: where hint records begin.
 */
export const CM_HINT_RECORDS_OFFSET = 2;

/**
 * Record size: number of Int32Array slots per hint.
 */
export const HINT_RECORD_STRIDE = 4;

/**
 * Record field: start offset of hint name.
 */
export const HINT_FIELD_NAME_START = 0;

/**
 * Record field: end offset of hint name.
 */
export const HINT_FIELD_NAME_END = 1;

/**
 * Record field: start offset of parameters (or -1 if absent).
 */
export const HINT_FIELD_PARAMS_START = 2;

/**
 * Record field: end offset of parameters (or -1 if absent).
 */
export const HINT_FIELD_PARAMS_END = 3;

/**
 * Parser for hint comment rules (`!+ HINT_NAME[(params)] ...`).
 */
export class HintCommentParser implements StructuralParser {
    /**
     * Fills `ctx.data` with hint structural indices.
     *
     * Assumes the caller has verified the rule starts with `!+`.
     *
     * @param ctx Parser context (tokenizer output must be loaded).
     * @param startTi Inclusive start token index. Defaults to 0.
     * @param endTi Exclusive end token index. Defaults to ctx.tokenCount.
     * @param dataOffset Offset within ctx.data to write output. Defaults to 0.
     */
    public static parse(ctx: ParserContext, startTi = 0, endTi = ctx.tokenCount, dataOffset = 0): void {
        const { data, ends } = ctx;

        // Skip leading whitespace, then `!` and `+`
        let ti = skipWs(ctx, startTi);

        // skip ! and +
        ti += 2;

        let count = 0;

        while (ti < endTi) {
            // Skip whitespace between hints
            ti = skipWs(ctx, ti);

            if (ti >= endTi) {
                break;
            }

            // Name starts here
            const nameStart = tokenStart(ctx, ti);

            // Consume name tokens: stop at whitespace, OpenParen, or end
            while (
                ti < endTi
                && ctx.types[ti] !== TokenType.Whitespace
                && ctx.types[ti] !== TokenType.OpenParen
            ) {
                ti += 1;
            }

            const nameEnd = ti > 0 ? ends[ti - 1] : nameStart;

            // Params: present if next (non-space) token is OpenParen
            let paramsStart = -1;
            let paramsEnd = -1;

            if (ti < endTi && ctx.types[ti] === TokenType.OpenParen) {
                // Include the opening paren in the params range
                paramsStart = tokenStart(ctx, ti);

                // skip OpenParen
                ti += 1;

                // Scan until matching CloseParen (no nesting allowed)
                while (ti < endTi && ctx.types[ti] !== TokenType.CloseParen) {
                    ti += 1;
                }

                // Include closing paren
                if (ti < endTi) {
                    // skip CloseParen
                    ti += 1;
                }

                paramsEnd = ti > 0 ? ends[ti - 1] : paramsStart;
            }

            // Write hint record
            const base = dataOffset + CM_HINT_RECORDS_OFFSET + count * HINT_RECORD_STRIDE;

            data[base + HINT_FIELD_NAME_START] = nameStart;
            data[base + HINT_FIELD_NAME_END] = nameEnd;
            data[base + HINT_FIELD_PARAMS_START] = paramsStart;
            data[base + HINT_FIELD_PARAMS_END] = paramsEnd;

            count += 1;
        }

        data[dataOffset + CM_KIND] = CommentKind.Hint;
        data[dataOffset + CM_HINT_COUNT_OFFSET] = count;
    }

    /**
     * Returns the number of hints in the rule.
     *
     * @param data Buffer written by `parse`.
     *
     * @returns Hint count.
     */
    public static count(data: Int32Array): number {
        return data[CM_HINT_COUNT_OFFSET];
    }

    /**
     * Returns the source start of the name of hint at index `i`.
     *
     * @param data Buffer written by `parse`.
     * @param i Hint index (0-based).
     *
     * @returns Source start offset of the hint name.
     */
    public static hintNameStart(data: Int32Array, i: number): number {
        return data[CM_HINT_RECORDS_OFFSET + i * HINT_RECORD_STRIDE + HINT_FIELD_NAME_START];
    }

    /**
     * Returns the exclusive source end of the name of hint at index `i`.
     *
     * @param data Buffer written by `parse`.
     * @param i Hint index (0-based).
     *
     * @returns Source end offset of the hint name.
     */
    public static hintNameEnd(data: Int32Array, i: number): number {
        return data[CM_HINT_RECORDS_OFFSET + i * HINT_RECORD_STRIDE + HINT_FIELD_NAME_END];
    }

    /**
     * Returns the source start of the parameters of hint at index `i`, or `-1` if absent.
     *
     * @param data Buffer written by `parse`.
     * @param i Hint index (0-based).
     *
     * @returns Source start offset of the parameters, or `-1`.
     */
    public static hintParamsStart(data: Int32Array, i: number): number {
        return data[CM_HINT_RECORDS_OFFSET + i * HINT_RECORD_STRIDE + HINT_FIELD_PARAMS_START];
    }

    /**
     * Returns the exclusive source end of the parameters of hint at index `i`, or `-1` if absent.
     *
     * @param data Buffer written by `parse`.
     * @param i Hint index (0-based).
     *
     * @returns Source end offset of the parameters, or `-1`.
     */
    public static hintParamsEnd(data: Int32Array, i: number): number {
        return data[CM_HINT_RECORDS_OFFSET + i * HINT_RECORD_STRIDE + HINT_FIELD_PARAMS_END];
    }
}
