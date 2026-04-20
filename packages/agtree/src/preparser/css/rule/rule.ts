/* eslint-disable no-param-reassign */

/**
 * @file CSS qualified rule preparser.
 *
 * `CssRulePreparser.preparse()` scans adblock tokens to find the structural
 * boundaries of a CSS qualified rule: the selector list (prelude), the
 * opening `{`, the declaration list (block body), and the closing `}`.
 *
 * All output is written to `ctx.data` (Int32Array) with zero heap allocations.
 *
 * Uses a **backward scanning** strategy: scans from the end of the token range
 * to find `}`, then scans backward from `}` to find the matching `{`. This
 * means selector tokens are never touched by the rule preparser — they are
 * only analyzed once by `SelectorListPreparser` during the AST build phase.
 *
 * During the backward scan, CSS strings are skipped by matching
 * `Quote`/`Apostrophe` tokens backward (the adblock tokenizer represents
 * escaped quotes as `Escaped` tokens, so simple type-matching suffices).
 *
 * @see {@link https://www.w3.org/TR/css-syntax-3/#consume-qualified-rule}
 */

import { isCssWhitespace } from '../../../css/tokenizer/css-token-utils';
import { AdblockSyntaxError } from '../../../errors/adblock-syntax-error';
import { TokenType } from '../../../tokenizer/token-types';
import type { PreparserContext } from '../../context';
import { tokenStart } from '../../context';

import {
    CR_CLOSE_BRACE_SOURCE_POS,
    CR_CLOSE_BRACE_TI,
    CR_DL_END_TI,
    CR_DL_SOURCE_END,
    CR_DL_SOURCE_START,
    CR_DL_START_TI,
    CR_MIN_DATA_SLOTS,
    CR_OPEN_BRACE_SOURCE_POS,
    CR_OPEN_BRACE_TI,
    CR_SL_END_TI,
    CR_SL_SOURCE_END,
    CR_SL_SOURCE_START,
    CR_SL_START_TI,
} from './constants';

/**
 * CSS qualified rule preparser.
 *
 * Uses backward scanning to find `}` and `{` without touching selector
 * tokens. Selector tokens are only analyzed once by the downstream
 * `SelectorListPreparser`.
 *
 * Writes all output to `ctx.data` with zero heap allocations.
 */
export class CssRulePreparser {
    /**
     * Minimum `ctx.data` capacity required for the default configuration.
     */
    public static readonly MIN_DATA_SLOTS = CR_MIN_DATA_SLOTS;

    /**
     * Preparse a CSS qualified rule token range.
     *
     * Reads tokens from `ctx.types`/`ctx.ends` in the range
     * `[startTi, endTi)` and writes a 12-slot header at `dataOffset`
     * containing structural boundaries for the selector list, braces,
     * and declaration list.
     *
     * Scans **backward** from `endTi` to find `}` and `{`, so selector
     * tokens are never touched.
     *
     * @param ctx Preparser context.
     * @param startTi Inclusive start token index.
     * @param endTi Exclusive end token index.
     * @param dataOffset Offset within `ctx.data` to start writing.
     *
     * @throws {AdblockSyntaxError} On missing `{`, unclosed `}`, or empty selector list.
     */
    public static preparse(
        ctx: PreparserContext,
        startTi: number,
        endTi: number,
        dataOffset: number,
    ): void {
        const {
            types,
            ends,
            data,
        } = ctx;

        // Phase 1: Find the closing brace
        // Scan backward from endTi, skipping trailing whitespace.
        let ti = endTi - 1;
        while (ti >= startTi && isCssWhitespace(types[ti])) {
            ti -= 1;
        }

        if (ti < startTi || types[ti] !== TokenType.CloseBrace) {
            let errorEnd: number;
            if (ti >= startTi) {
                errorEnd = ends[ti];
            } else if (endTi > 0) {
                errorEnd = ends[endTi - 1];
            } else {
                errorEnd = 0;
            }
            throw new AdblockSyntaxError(
                'Expected closing "}" in CSS rule',
                tokenStart(ctx, startTi),
                errorEnd,
            );
        }

        const closeBraceTi = ti;

        // Phase 2: Find the matching opening brace
        // Scan backward from closeBraceTi, tracking brace depth. Skip CSS
        // strings by matching Quote/Apostrophe tokens backward.
        // This only scans block body tokens, never selector tokens.
        ti = closeBraceTi - 1;
        let braceDepth = 1;
        let openBraceTi = -1;

        while (ti >= startTi && braceDepth > 0) {
            const type = types[ti];

            // Skip CSS strings backward: a Quote/Apostrophe here is a closing
            // quote. Scan backward for the matching opening quote of the same
            // type. Escaped quotes are Escaped tokens (not Quote/Apostrophe),
            // so simple type-matching works.
            if (type === TokenType.Quote || type === TokenType.Apostrophe) {
                const quoteType = type;
                ti -= 1;
                while (ti >= startTi && types[ti] !== quoteType) {
                    ti -= 1;
                }
                // ti now points at the opening quote or is < startTi
                // (unterminated string — malformed CSS, downstream will error).
                ti -= 1;
                // eslint-disable-next-line no-continue
                continue;
            }

            if (type === TokenType.CloseBrace) {
                braceDepth += 1;
            } else if (type === TokenType.OpenBrace) {
                braceDepth -= 1;
                if (braceDepth === 0) {
                    openBraceTi = ti;
                    break;
                }
            }

            ti -= 1;
        }

        if (openBraceTi === -1) {
            throw new AdblockSyntaxError(
                'Expected opening "{" in CSS rule',
                tokenStart(ctx, startTi),
                ends[closeBraceTi],
            );
        }

        // Phase 3: Determine selector list boundaries
        // The selector list is everything before the opening brace, trimmed of
        // leading/trailing whitespace.
        let slStartTi = startTi;
        while (slStartTi < openBraceTi && isCssWhitespace(types[slStartTi])) {
            slStartTi += 1;
        }

        let slEndTi = openBraceTi;
        while (slEndTi > slStartTi && isCssWhitespace(types[slEndTi - 1])) {
            slEndTi -= 1;
        }

        if (slStartTi >= slEndTi) {
            throw new AdblockSyntaxError(
                'Empty selector list in CSS rule',
                tokenStart(ctx, startTi),
                ends[openBraceTi],
            );
        }

        const slSourceStart = tokenStart(ctx, slStartTi);
        const slSourceEnd = ends[slEndTi - 1];

        // Phase 4: Determine declaration list boundaries
        // The declaration list is everything between `{` and `}`, trimmed of
        // leading/trailing whitespace.
        let dlStartTi = openBraceTi + 1;
        while (dlStartTi < closeBraceTi && isCssWhitespace(types[dlStartTi])) {
            dlStartTi += 1;
        }

        let dlEndTi = closeBraceTi;
        while (dlEndTi > dlStartTi && isCssWhitespace(types[dlEndTi - 1])) {
            dlEndTi -= 1;
        }

        // For empty blocks (e.g., `div { }`), dlStartTi === dlEndTi is valid.
        // Source offsets for empty ranges: both point to the same position.
        const dlSourceStart = dlStartTi < dlEndTi
            ? tokenStart(ctx, dlStartTi)
            : tokenStart(ctx, closeBraceTi);
        const dlSourceEnd = dlStartTi < dlEndTi
            ? ends[dlEndTi - 1]
            : dlSourceStart;

        // Phase 5: Write header slots
        data[dataOffset + CR_SL_SOURCE_START] = slSourceStart;
        data[dataOffset + CR_SL_SOURCE_END] = slSourceEnd;
        data[dataOffset + CR_SL_START_TI] = slStartTi;
        data[dataOffset + CR_SL_END_TI] = slEndTi;
        data[dataOffset + CR_OPEN_BRACE_SOURCE_POS] = tokenStart(ctx, openBraceTi);
        data[dataOffset + CR_OPEN_BRACE_TI] = openBraceTi;
        data[dataOffset + CR_CLOSE_BRACE_SOURCE_POS] = tokenStart(ctx, closeBraceTi);
        data[dataOffset + CR_CLOSE_BRACE_TI] = closeBraceTi;
        data[dataOffset + CR_DL_SOURCE_START] = dlSourceStart;
        data[dataOffset + CR_DL_SOURCE_END] = dlSourceEnd;
        data[dataOffset + CR_DL_START_TI] = dlStartTi;
        data[dataOffset + CR_DL_END_TI] = dlEndTi;
    }

    /**
     * Source start offset of the selector list.
     *
     * @param data Output buffer.
     * @param dataOffset Base offset for rule data.
     *
     * @returns Source start offset.
     */
    public static selectorListSourceStart(data: Int32Array, dataOffset: number): number {
        return data[dataOffset + CR_SL_SOURCE_START];
    }

    /**
     * Source end offset of the selector list.
     *
     * @param data Output buffer.
     * @param dataOffset Base offset for rule data.
     *
     * @returns Source end offset.
     */
    public static selectorListSourceEnd(data: Int32Array, dataOffset: number): number {
        return data[dataOffset + CR_SL_SOURCE_END];
    }

    /**
     * Token index of the first selector list token.
     *
     * @param data Output buffer.
     * @param dataOffset Base offset for rule data.
     *
     * @returns Token index (inclusive).
     */
    public static selectorListStartTi(data: Int32Array, dataOffset: number): number {
        return data[dataOffset + CR_SL_START_TI];
    }

    /**
     * Exclusive end token index of the selector list.
     *
     * @param data Output buffer.
     * @param dataOffset Base offset for rule data.
     *
     * @returns Token index (exclusive).
     */
    public static selectorListEndTi(data: Int32Array, dataOffset: number): number {
        return data[dataOffset + CR_SL_END_TI];
    }

    /**
     * Source offset of the opening `{`.
     *
     * @param data Output buffer.
     * @param dataOffset Base offset for rule data.
     *
     * @returns Source offset.
     */
    public static openBraceSourcePos(data: Int32Array, dataOffset: number): number {
        return data[dataOffset + CR_OPEN_BRACE_SOURCE_POS];
    }

    /**
     * Token index of the opening `{`.
     *
     * @param data Output buffer.
     * @param dataOffset Base offset for rule data.
     *
     * @returns Token index.
     */
    public static openBraceTi(data: Int32Array, dataOffset: number): number {
        return data[dataOffset + CR_OPEN_BRACE_TI];
    }

    /**
     * Source offset of the closing `}`.
     *
     * @param data Output buffer.
     * @param dataOffset Base offset for rule data.
     *
     * @returns Source offset.
     */
    public static closeBraceSourcePos(data: Int32Array, dataOffset: number): number {
        return data[dataOffset + CR_CLOSE_BRACE_SOURCE_POS];
    }

    /**
     * Token index of the closing `}`.
     *
     * @param data Output buffer.
     * @param dataOffset Base offset for rule data.
     *
     * @returns Token index.
     */
    public static closeBraceTi(data: Int32Array, dataOffset: number): number {
        return data[dataOffset + CR_CLOSE_BRACE_TI];
    }

    /**
     * Source start offset of the declaration list.
     *
     * @param data Output buffer.
     * @param dataOffset Base offset for rule data.
     *
     * @returns Source start offset.
     */
    public static declListSourceStart(data: Int32Array, dataOffset: number): number {
        return data[dataOffset + CR_DL_SOURCE_START];
    }

    /**
     * Source end offset of the declaration list.
     *
     * @param data Output buffer.
     * @param dataOffset Base offset for rule data.
     *
     * @returns Source end offset.
     */
    public static declListSourceEnd(data: Int32Array, dataOffset: number): number {
        return data[dataOffset + CR_DL_SOURCE_END];
    }

    /**
     * Token index of the first declaration list token.
     *
     * @param data Output buffer.
     * @param dataOffset Base offset for rule data.
     *
     * @returns Token index (inclusive).
     */
    public static declListStartTi(data: Int32Array, dataOffset: number): number {
        return data[dataOffset + CR_DL_START_TI];
    }

    /**
     * Exclusive end token index of the declaration list.
     *
     * @param data Output buffer.
     * @param dataOffset Base offset for rule data.
     *
     * @returns Token index (exclusive).
     */
    public static declListEndTi(data: Int32Array, dataOffset: number): number {
        return data[dataOffset + CR_DL_END_TI];
    }
}
