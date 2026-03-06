/**
 * @file Hint comment preparser.
 *
 * Handles `!+ HINT_NAME[(params)] ...` rules. Records per-hint name and
 * optional parameter bounds in `ctx.data`.
 *
 * @see {@link https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#hints}
 */

import { TokenType } from '../../tokenizer/token-types';
import type { PreparserContext } from '../context';
import { skipWs, tokenStart } from '../context';
import {
    CM_HINT_COUNT,
    CM_HINT_HEADER,
    CM_HINT_NAME_END,
    CM_HINT_NAME_START,
    CM_HINT_PARAMS_END,
    CM_HINT_PARAMS_START,
    CM_HINT_STRIDE,
    CM_KIND,
    CommentKind,
} from './types';

/**
 * Preparser for hint comment rules (`!+ HINT_NAME[(params)] ...`).
 */
export class HintCommentPreparser {
    /**
     * Fills `ctx.data` with hint structural indices.
     *
     * Assumes the caller has verified the rule starts with `!+`.
     *
     * @param ctx Preparser context (tokenizer output must be loaded).
     */
    public static preparse(ctx: PreparserContext): void {
        const { data, ends, tokenCount } = ctx;

        // Skip leading whitespace, then `!` and `+`
        let ti = skipWs(ctx, 0);

        // skip ! and +
        ti += 2;

        let count = 0;

        while (ti < tokenCount) {
            // Skip whitespace between hints
            ti = skipWs(ctx, ti);

            if (ti >= tokenCount) {
                break;
            }

            // Name starts here
            const nameStart = tokenStart(ctx, ti);

            // Consume name tokens: stop at whitespace, OpenParen, or end
            while (
                ti < tokenCount
                && ctx.types[ti] !== TokenType.Whitespace
                && ctx.types[ti] !== TokenType.OpenParen
            ) {
                ti += 1;
            }

            const nameEnd = ti > 0 ? ends[ti - 1] : nameStart;

            // Params: present if next (non-space) token is OpenParen
            let paramsStart = -1;
            let paramsEnd = -1;

            if (ti < tokenCount && ctx.types[ti] === TokenType.OpenParen) {
                // Include the opening paren in the params range
                paramsStart = tokenStart(ctx, ti);

                // skip OpenParen
                ti += 1;

                // Scan until matching CloseParen (no nesting allowed)
                while (ti < tokenCount && ctx.types[ti] !== TokenType.CloseParen) {
                    ti += 1;
                }

                // Include closing paren
                if (ti < tokenCount) {
                    // skip CloseParen
                    ti += 1;
                }

                paramsEnd = ti > 0 ? ends[ti - 1] : paramsStart;
            }

            // Write hint record
            const base = CM_HINT_HEADER + count * CM_HINT_STRIDE;

            data[base + CM_HINT_NAME_START] = nameStart;
            data[base + CM_HINT_NAME_END] = nameEnd;
            data[base + CM_HINT_PARAMS_START] = paramsStart;
            data[base + CM_HINT_PARAMS_END] = paramsEnd;

            count += 1;
        }

        data[CM_KIND] = CommentKind.Hint;
        data[CM_HINT_COUNT] = count;
    }

    /**
     * Returns the number of hints in the rule.
     *
     * @param data Buffer written by `preparse`.
     * @returns Hint count.
     */
    public static count(data: Int32Array): number {
        return data[CM_HINT_COUNT];
    }

    /**
     * Returns the source start of the name of hint at index `i`.
     *
     * @param data Buffer written by `preparse`.
     * @param i Hint index (0-based).
     * @returns Source start offset of the hint name.
     */
    public static hintNameStart(data: Int32Array, i: number): number {
        return data[CM_HINT_HEADER + i * CM_HINT_STRIDE + CM_HINT_NAME_START];
    }

    /**
     * Returns the exclusive source end of the name of hint at index `i`.
     *
     * @param data Buffer written by `preparse`.
     * @param i Hint index (0-based).
     * @returns Source end offset of the hint name.
     */
    public static hintNameEnd(data: Int32Array, i: number): number {
        return data[CM_HINT_HEADER + i * CM_HINT_STRIDE + CM_HINT_NAME_END];
    }

    /**
     * Returns the source start of the parameters of hint at index `i`, or `-1` if absent.
     *
     * @param data Buffer written by `preparse`.
     * @param i Hint index (0-based).
     * @returns Source start offset of the parameters, or `-1`.
     */
    public static hintParamsStart(data: Int32Array, i: number): number {
        return data[CM_HINT_HEADER + i * CM_HINT_STRIDE + CM_HINT_PARAMS_START];
    }

    /**
     * Returns the exclusive source end of the parameters of hint at index `i`, or `-1` if absent.
     *
     * @param data Buffer written by `preparse`.
     * @param i Hint index (0-based).
     * @returns Source end offset of the parameters, or `-1`.
     */
    public static hintParamsEnd(data: Int32Array, i: number): number {
        return data[CM_HINT_HEADER + i * CM_HINT_STRIDE + CM_HINT_PARAMS_END];
    }
}
