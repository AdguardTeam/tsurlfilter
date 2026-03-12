/* eslint-disable no-param-reassign */

/**
 * @file Parameter list preparser.
 *
 * Parses a parenthesised, comma-separated value list into a flat
 * `Int32Array` buffer for zero-allocation downstream consumption.
 */

import { TokenType } from '../../tokenizer/token-types';
import type { PreparserContext } from '../context';
import { lastNonWs, skipWs, tokenStart } from '../context';

// ---------------------------------------------------------------------------
// Buffer layout  (relative indices inside the supplied Int32Array)
// ---------------------------------------------------------------------------

/**
 * Number of parameters stored in the buffer.
 */
export const PL_COUNT = 0;

/**
 * Source start of the inner content (right after the opening `(`).
 */
export const PL_LIST_START = 1;

/**
 * Source end of the inner content (right before the closing `)`).
 */
export const PL_LIST_END = 2;

/**
 * Index where per-parameter entries begin.
 * Each entry occupies {@link PL_STRIDE} consecutive slots:
 *   `[PL_PARAM_START, PL_PARAM_END]` — source range of the value.
 * `PL_PARAM_START === -1` signals a null (empty) parameter.
 */
export const PL_HEADER = 3;

/**
 * Number of `Int32` slots per parameter entry.
 */
export const PL_STRIDE = 2;

/**
 * Offset within a stride entry: source start of the parameter value.
 */
export const PL_PARAM_START = 0;

/**
 * Offset within a stride entry: source end (exclusive) of the parameter value.
 */
export const PL_PARAM_END = 1;

/**
 * Maximum number of parameters the buffer can hold.
 */
export const PL_MAX_PARAMS = 32;

/**
 * Total `Int32` slots required for the parameter-list buffer.
 * `PL_HEADER(3) + PL_MAX_PARAMS(32) * PL_STRIDE(2) = 67`
 */
export const PL_BUFFER_SIZE = PL_HEADER + PL_MAX_PARAMS * PL_STRIDE;

/**
 * Preparser for comma-separated parameter lists.
 *
 * The caller is responsible for stripping any surrounding `(` / `)` tokens
 * and passing the inner token range together with the corresponding source
 * bounds.
 */
export class ParameterListPreparser {
    /**
     * Parses a comma-separated token sequence `[startTi, endTi)` and writes
     * results to `buf`.
     *
     * After a successful call:
     * - `buf[PL_COUNT]` — number of parameters (including null slots).
     * - `buf[PL_LIST_START]` / `buf[PL_LIST_END]` — copied from `listStart` /
     *   `listEnd` for use by the AST layer.
     * - For each parameter `i`:
     *   - `buf[PL_HEADER + i * PL_STRIDE + PL_PARAM_START]` — source start, or
     *     `-1` for a null (empty) parameter.
     *   - `buf[PL_HEADER + i * PL_STRIDE + PL_PARAM_END]` — source end.
     *
     * @param ctx Preparser context (tokenizer output must be loaded).
     * @param startTi First inner token index (right after `(`).
     * @param endTi Exclusive boundary — the index of the closing `)` token
     *                  (or token count when there is no `)`).
     * @param listStart Source position right after the opening `(`.
     * @param listEnd Source position of the closing `)`.
     * @param buf Output buffer (at least {@link PL_BUFFER_SIZE} elements).
     */
    public static preparse(
        ctx: PreparserContext,
        startTi: number,
        endTi: number,
        listStart: number,
        listEnd: number,
        buf: Int32Array,
    ): void {
        buf[PL_COUNT] = 0;
        buf[PL_LIST_START] = listStart;
        buf[PL_LIST_END] = listEnd;

        // Empty list — nothing to parse
        if (startTi >= endTi) {
            return;
        }

        const { types, ends } = ctx;

        // Parse comma-separated segments in [startTi, endTi)
        let paramCount = 0;
        let segTi = startTi;

        while (segTi <= endTi) {
            // Find the next comma within [segTi, endTi)
            let sepTi = segTi;
            while (sepTi < endTi && types[sepTi] !== TokenType.Comma) {
                sepTi += 1;
            }

            // Trim whitespace from the segment [segTi, sepTi)
            const pFirstTi = skipWs(ctx, segTi);
            const pLastTi = lastNonWs(ctx, segTi, sepTi);

            const pidx = PL_HEADER + paramCount * PL_STRIDE;

            if (pFirstTi < sepTi && pLastTi >= 0) {
                buf[pidx + PL_PARAM_START] = tokenStart(ctx, pFirstTi);
                buf[pidx + PL_PARAM_END] = ends[pLastTi];
            } else {
                buf[pidx + PL_PARAM_START] = -1;
                buf[pidx + PL_PARAM_END] = -1;
            }

            paramCount += 1;
            // When a comma was found (sepTi < endTi) advance past it;
            // otherwise step past endTi to terminate the loop.
            segTi = sepTi < endTi ? sepTi + 1 : endTi + 1;
        }

        buf[PL_COUNT] = paramCount;
    }
}
