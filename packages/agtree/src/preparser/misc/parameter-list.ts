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
 *   `[PL_PARAM_START, PL_PARAM_END, PL_PARAM_FLAGS]` — source range + metadata.
 * `PL_PARAM_START === -1` signals a null (empty) parameter.
 */
export const PL_HEADER = 3;

/**
 * Number of `Int32` slots per parameter entry.
 */
export const PL_STRIDE = 3;

/**
 * Offset within a stride entry: source start of the parameter value.
 */
export const PL_PARAM_START = 0;

/**
 * Offset within a stride entry: source end (exclusive) of the parameter value.
 */
export const PL_PARAM_END = 1;

/**
 * Offset within a stride entry: flags bitfield.
 * - bits 0-1: quote type (0=none, 1=single, 2=double, 3=backtick)
 * - bit 2: {@link PL_FLAG_TRANSFORM} (value needs un-escaping)
 * - bit 3: {@link PL_FLAG_FAILED} (mustQuote violation).
 */
export const PL_PARAM_FLAGS = 2;

/**
 * Maximum number of parameters the buffer can hold.
 */
export const PL_MAX_PARAMS = 32;

/**
 * Flag bit indicating the parameter value needs un-escaping (escaped separator chars).
 */
export const PL_FLAG_TRANSFORM = 0x04;

/**
 * Flag bit indicating mustQuote mode violation (unquoted parameter when quoting required).
 */
export const PL_FLAG_FAILED = 0x08;

/**
 * Total `Int32` slots required for the parameter-list buffer.
 * `PL_HEADER(3) + PL_MAX_PARAMS(32) * PL_STRIDE(3) = 99`.
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
     * Parses a token sequence `[startTi, endTi)` separated by the given token type
     * and writes results to `buf`.
     *
     * After a successful call:
     * - `buf[PL_COUNT]` — number of parameters (including null slots).
     * - `buf[PL_LIST_START]` / `buf[PL_LIST_END]` — copied from `listStart` /
     *   `listEnd` for use by the AST layer.
     * - For each parameter `i`:
     *   - `buf[PL_HEADER + i * PL_STRIDE + PL_PARAM_START]` — source start, or
     *     `-1` for a null (empty) parameter.
     *   - `buf[PL_HEADER + i * PL_STRIDE + PL_PARAM_END]` — source end.
     *   - `buf[PL_HEADER + i * PL_STRIDE + PL_PARAM_FLAGS]` — flags (quote type,
     *     transform, failed).
     *
     * @param ctx Preparser context (tokenizer output must be loaded).
     * @param startTi First inner token index (right after `(`).
     * @param endTi Exclusive boundary — the index of the closing `)` token
     *                  (or token count when there is no `)`).
     * @param listStart Source position right after the opening `(`.
     * @param listEnd Source position of the closing `)`.
     * @param buf Output buffer (at least {@link PL_BUFFER_SIZE} elements).
     * @param separator Token type to use as separator (default: Comma).
     * @param mustQuote If true, unquoted parameters are flagged as failures.
     */
    public static preparse(
        ctx: PreparserContext,
        startTi: number,
        endTi: number,
        listStart: number,
        listEnd: number,
        buf: Int32Array,
        separator: TokenType = TokenType.Comma,
        mustQuote = false,
    ): void {
        buf[PL_COUNT] = 0;
        buf[PL_LIST_START] = listStart;
        buf[PL_LIST_END] = listEnd;

        // Empty list — nothing to parse
        if (startTi >= endTi) {
            return;
        }

        const { types, ends, source } = ctx;

        // Parse separator-delimited segments in [startTi, endTi)
        let paramCount = 0;
        let segTi = startTi;

        while (segTi <= endTi) {
            // Find the next separator within [segTi, endTi), respecting quotes
            let sepTi = segTi;
            let quoteType = 0; // 0=none, 1=single, 2=double, 3=backtick
            let hasTransform = false;
            let hasFailed = false;

            // Trim leading whitespace
            const pFirstTi = skipWs(ctx, segTi);

            // Check if parameter starts with a quote
            if (pFirstTi < endTi) {
                const firstType = types[pFirstTi];
                const firstCharCode = pFirstTi < ctx.tokenCount
                    ? source.charCodeAt(tokenStart(ctx, pFirstTi))
                    : 0;

                // Detect quote type
                if (firstType === TokenType.Apostrophe) {
                    quoteType = 1; // single
                } else if (firstType === TokenType.Quote) {
                    quoteType = 2; // double
                } else if (firstType === TokenType.Symbol && firstCharCode === 0x60) {
                    quoteType = 3; // backtick
                }

                if (quoteType !== 0) {
                    // Quoted parameter: scan for matching closing quote
                    let ti = pFirstTi + 1;
                    let closeQuoteTi = -1;

                    while (ti < endTi) {
                        const tt = types[ti];

                        // Skip escaped tokens
                        if (tt === TokenType.Escaped) {
                            ti += 1;
                            continue;
                        }

                        // Check for matching closing quote
                        const isMatch = (quoteType === 1 && tt === TokenType.Apostrophe)
                            || (quoteType === 2 && tt === TokenType.Quote)
                            || (quoteType === 3 && tt === TokenType.Symbol
                                && source.charCodeAt(tokenStart(ctx, ti)) === 0x60);

                        if (isMatch) {
                            closeQuoteTi = ti;
                            break;
                        }

                        ti += 1;
                    }

                    if (closeQuoteTi >= 0) {
                        // Found closing quote — check if followed by separator or end
                        const afterQuoteTi = skipWs(ctx, closeQuoteTi + 1);
                        if (afterQuoteTi >= endTi || types[afterQuoteTi] === separator) {
                            // Valid quoted param — scan to find separator
                            sepTi = afterQuoteTi < endTi ? afterQuoteTi : endTi;
                        } else {
                            // Closing quote not followed by separator — fall back to unquoted scan
                            quoteType = 0;
                            sepTi = this.findNextSeparator(
                                ctx,
                                pFirstTi,
                                endTi,
                                separator,
                            );
                            hasTransform = this.checkTransform(ctx, pFirstTi, sepTi, separator);
                        }
                    } else {
                        // No closing quote found — extend to end or next separator outside quotes
                        sepTi = endTi;
                    }
                } else {
                    // Unquoted parameter
                    sepTi = this.findNextSeparator(ctx, pFirstTi, endTi, separator);
                    hasTransform = this.checkTransform(ctx, pFirstTi, sepTi, separator);
                    if (mustQuote) {
                        hasFailed = true;
                    }
                }
            } else {
                // Empty or whitespace-only segment
                sepTi = segTi;
                while (sepTi < endTi && types[sepTi] !== separator) {
                    sepTi += 1;
                }
            }

            // Trim trailing whitespace from the segment [segTi, sepTi)
            const pLastTi = lastNonWs(ctx, segTi, sepTi);

            const pidx = PL_HEADER + paramCount * PL_STRIDE;

            if (pFirstTi < sepTi && pLastTi >= 0) {
                buf[pidx + PL_PARAM_START] = tokenStart(ctx, pFirstTi);
                buf[pidx + PL_PARAM_END] = ends[pLastTi];

                // Pack flags: bits 0-1 = quote type, bit 2 = transform, bit 3 = failed
                let flags = quoteType;
                if (hasTransform) {
                    flags |= PL_FLAG_TRANSFORM;
                }
                if (hasFailed) {
                    flags |= PL_FLAG_FAILED;
                }
                buf[pidx + PL_PARAM_FLAGS] = flags;
            } else {
                // Null parameter
                buf[pidx + PL_PARAM_START] = -1;
                buf[pidx + PL_PARAM_END] = -1;
                buf[pidx + PL_PARAM_FLAGS] = 0;
            }

            paramCount += 1;
            // When a separator was found (sepTi < endTi) advance past it;
            // otherwise step past endTi to terminate the loop.
            segTi = sepTi < endTi ? sepTi + 1 : endTi + 1;
        }

        buf[PL_COUNT] = paramCount;
    }

    /**
     * Finds the next unescaped separator token in the range `[startTi, endTi)`.
     *
     * @param ctx Preparser context.
     * @param startTi Start token index.
     * @param endTi End token index (exclusive).
     * @param separator Separator token type.
     *
     * @returns Token index of the separator, or `endTi` if not found.
     */
    private static findNextSeparator(
        ctx: PreparserContext,
        startTi: number,
        endTi: number,
        separator: TokenType,
    ): number {
        const { types } = ctx;
        let ti = startTi;

        while (ti < endTi) {
            if (types[ti] === separator) {
                return ti;
            }
            ti += 1;
        }

        return endTi;
    }

    /**
     * Checks if the token range contains escaped separator characters.
     *
     * @param ctx Preparser context.
     * @param startTi Start token index.
     * @param endTi End token index (exclusive).
     * @param separator Separator token type.
     *
     * @returns True if any Escaped token contains the separator character.
     */
    private static checkTransform(
        ctx: PreparserContext,
        startTi: number,
        endTi: number,
        separator: TokenType,
    ): boolean {
        const { types, source } = ctx;

        // Map separator token type to its character
        let sepChar = ',';
        if (separator === TokenType.Semicolon) {
            sepChar = ';';
        } else if (separator === TokenType.Whitespace) {
            sepChar = ' ';
        }

        for (let ti = startTi; ti < endTi; ti += 1) {
            if (types[ti] === TokenType.Escaped) {
                const start = tokenStart(ctx, ti);
                const end = ctx.ends[ti];
                const escapedText = source.slice(start, end);
                // Check if the escaped token contains the separator character
                // (e.g., "\," contains ",")
                if (escapedText.includes(sepChar)) {
                    return true;
                }
            }
        }

        return false;
    }
}
