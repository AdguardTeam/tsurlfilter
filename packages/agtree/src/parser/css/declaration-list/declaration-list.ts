/* eslint-disable no-param-reassign */

/**
 * @file CSS declaration list parser.
 *
 * `DeclarationListParser.parse()` consumes adblock tokens directly and
 * writes structural offset records to a region of `ctx.data` with zero heap
 * allocations.
 *
 * Architecture:
 *   - One header slot: declaration count.
 *   - One record (6 slots) per declaration: property start/end, value
 *     start/end, important flag, and full declaration end (including !important).
 *   - Fixed stride for O(1) indexed access.
 *
 * @see {@link https://www.w3.org/TR/css-syntax-3/#consume-list-of-declarations}
 */

import { consumeCssIdentRun, isCssIdentStart, isCssWhitespace } from '../../../css/tokenizer/css-token-utils';
import { AdblockSyntaxError } from '../../../errors/adblock-syntax-error';
import { TokenType } from '../../../tokenizer/token-types';
import type { ParserContext } from '../../context';
import { CTX_STATUS_OVERFLOW, regionEqualsCI, tokenStart } from '../../context';
import type { StructuralParser } from '../../types';

import {
    DECL_FIELD_DECL_END,
    DECL_FIELD_IMPORTANT,
    DECL_FIELD_PROPERTY_END,
    DECL_FIELD_PROPERTY_START,
    DECL_FIELD_VALUE_END,
    DECL_FIELD_VALUE_START,
    DECL_STRIDE,
    DEFAULT_MAX_DECLARATIONS,
    DL_COUNT_OFFSET,
    DL_HEADER_SIZE,
    DL_MIN_DATA_SLOTS,
} from './constants';

/**
 * CSS declaration list parser.
 *
 * Performs a single-pass structural analysis of a CSS declaration list
 * encoded as adblock tokens. Writes all output to `ctx.data` with zero
 * heap allocations.
 */
export class DeclarationListParser implements StructuralParser {
    /**
     * Minimum `ctx.data` capacity required for the default configuration.
     */
    public static readonly MIN_DATA_SLOTS = DL_MIN_DATA_SLOTS;

    /**
     * Preparse a CSS declaration list token range.
     *
     * Reads tokens from `ctx.types`/`ctx.ends` in the range
     * `[startTi, endTi)` and writes:
     *   - A 1-slot header at `dataOffset` (declaration count).
     *   - Up to `maxDeclarations` declaration records at
     *     `dataOffset + DL_HEADER_SIZE`.
     *
     * @param ctx Parser context.
     * @param startTi Inclusive start token index.
     * @param endTi Exclusive end token index.
     * @param dataOffset Offset within `ctx.data` to start writing.
     * @param maxDeclarations Maximum supported declarations (default 16).
     *
     * @throws {AdblockSyntaxError} On any structural syntax error.
     */
    public static parse(
        ctx: ParserContext,
        startTi: number,
        endTi: number,
        dataOffset: number,
        maxDeclarations: number = DEFAULT_MAX_DECLARATIONS,
    ): void {
        const {
            types,
            ends,
            source,
            data,
        } = ctx;

        let ti = startTi;
        let declCount = 0;

        // Main loop: consume declarations separated by semicolons (CSS §5.4.5)
        while (ti < endTi) {
            const type = types[ti];

            // Skip whitespace and semicolons between declarations
            if (type === TokenType.Semicolon || isCssWhitespace(type)) {
                ti += 1;
                continue;
            }

            // Property name must start with an ident-start or a hyphen that
            // begins a vendor-prefix (-webkit-*) or custom property (--var).
            // Per CSS Syntax Level 3 an ident can start with:
            //   (a) ident-start code point (letter, underscore, non-ASCII), or
            //   (b) '-' followed by '-' or an ident-start code point.
            const isHyphenStart = type === TokenType.Hyphen
                && ti + 1 < endTi
                && (isCssIdentStart(types[ti + 1]) || types[ti + 1] === TokenType.Hyphen);

            if (!isCssIdentStart(type) && !isHyphenStart) {
                throw new AdblockSyntaxError(
                    'Expected a CSS property name',
                    tokenStart(ctx, ti),
                    ends[ti],
                );
            }

            // Capacity check: signal status and bail rather than throw.
            if (declCount >= maxDeclarations) {
                ctx.status = CTX_STATUS_OVERFLOW;
                ctx.data[dataOffset] = declCount;
                return;
            }

            // --- Consume property name ---
            const propStartOffset = tokenStart(ctx, ti);
            ti = consumeCssIdentRun(types, ti, endTi);
            const propEndOffset = ends[ti - 1];

            // Skip optional whitespace after property name
            if (ti < endTi && isCssWhitespace(types[ti])) {
                ti += 1;
            }

            // Expect colon
            if (ti >= endTi || types[ti] !== TokenType.Colon) {
                throw new AdblockSyntaxError(
                    'Expected ":" after property name',
                    propStartOffset,
                    propEndOffset,
                );
            }
            // skip colon
            ti += 1;

            // Skip optional whitespace after colon
            if (ti < endTi && isCssWhitespace(types[ti])) {
                ti += 1;
            }

            // --- Consume value tokens (with balanced bracket tracking) ---
            const valueStartTi = ti;
            let depth = 0;

            while (ti < endTi) {
                const vt = types[ti];
                if (vt === TokenType.Semicolon && depth === 0) {
                    break;
                }
                if (vt === TokenType.OpenParen || vt === TokenType.OpenSquare) {
                    depth += 1;
                } else if (vt === TokenType.CloseParen || vt === TokenType.CloseSquare) {
                    if (depth === 0) {
                        throw new AdblockSyntaxError(
                            'Unmatched closing bracket in declaration value',
                            tokenStart(ctx, ti),
                            ends[ti],
                        );
                    }
                    depth -= 1;
                }
                ti += 1;
            }

            // exclusive — ti points at semicolon or endTi
            const valueEndTi = ti;

            if (depth > 0) {
                throw new AdblockSyntaxError(
                    'Unclosed bracket in declaration value',
                    tokenStart(ctx, valueStartTi),
                    ends[valueEndTi - 1],
                );
            }

            // Trim trailing whitespace from value token range
            let trimmedEndTi = valueEndTi;
            while (trimmedEndTi > valueStartTi && isCssWhitespace(types[trimmedEndTi - 1])) {
                trimmedEndTi -= 1;
            }

            // Trim leading whitespace from value token range
            let trimmedStartTi = valueStartTi;
            while (trimmedStartTi < trimmedEndTi && isCssWhitespace(types[trimmedStartTi])) {
                trimmedStartTi += 1;
            }

            // --- Detect !important (CSS §5.4.6) ---
            // Check if last two non-ws tokens are ExclamationMark + ident 'important'
            let important = 0;
            let effectiveEndTi = trimmedEndTi;

            if (trimmedEndTi - trimmedStartTi >= 2) {
                const lastTi = trimmedEndTi - 1;

                // Last token must be an ident (isCssIdentStart is sufficient as
                // a leading check since we only care about the word 'important')
                if (isCssIdentStart(types[lastTi])) {
                    const identStart = tokenStart(ctx, lastTi);
                    const identEnd = ends[lastTi];

                    if (regionEqualsCI(source, identStart, identEnd, 'important')) {
                        // Find previous non-ws token
                        let prevTi = lastTi - 1;
                        while (prevTi >= trimmedStartTi && isCssWhitespace(types[prevTi])) {
                            prevTi -= 1;
                        }

                        if (prevTi >= trimmedStartTi && types[prevTi] === TokenType.ExclamationMark) {
                            important = 1;

                            // Trim !important from effectiveEndTi — find the
                            // token before '!' and trim trailing whitespace
                            effectiveEndTi = prevTi;
                            while (effectiveEndTi > trimmedStartTi && isCssWhitespace(types[effectiveEndTi - 1])) {
                                effectiveEndTi -= 1;
                            }
                        }
                    }
                }
            }

            // Compute source offsets for trimmed value (excluding !important).
            // If the value is empty after trimming, set both offsets equal.
            let valueStartOffset: number;
            let valueEndOffset: number;

            if (effectiveEndTi > trimmedStartTi) {
                valueStartOffset = tokenStart(ctx, trimmedStartTi);
                valueEndOffset = ends[effectiveEndTi - 1];
            } else {
                // Empty value (e.g., 'display: !important' — degenerate case)
                valueStartOffset = trimmedStartTi < valueEndTi
                    ? tokenStart(ctx, trimmedStartTi)
                    : tokenStart(ctx, valueStartTi);
                valueEndOffset = valueStartOffset;
            }

            // Compute full declaration end (including !important when present).
            // trimmedEndTi points past the last non-ws value token before any
            // !important trimming, so ends[trimmedEndTi - 1] captures the end
            // of 'important' when present, or the end of the value otherwise.
            const declEndOffset = trimmedEndTi > trimmedStartTi
                ? ends[trimmedEndTi - 1]
                : propEndOffset;

            // --- Write declaration record ---
            const base = dataOffset + DL_HEADER_SIZE + declCount * DECL_STRIDE;
            data[base + DECL_FIELD_PROPERTY_START] = propStartOffset;
            data[base + DECL_FIELD_PROPERTY_END] = propEndOffset;
            data[base + DECL_FIELD_VALUE_START] = valueStartOffset;
            data[base + DECL_FIELD_VALUE_END] = valueEndOffset;
            data[base + DECL_FIELD_IMPORTANT] = important;
            data[base + DECL_FIELD_DECL_END] = declEndOffset;

            declCount += 1;
        }

        // Write header
        data[dataOffset + DL_COUNT_OFFSET] = declCount;
    }

    /**
     * Number of declarations in the parsed list.
     *
     * @param data Output buffer.
     * @param dataOffset Base offset for declaration-list data.
     *
     * @returns Declaration count.
     */
    public static declCount(data: Int32Array, dataOffset: number): number {
        return data[dataOffset + DL_COUNT_OFFSET];
    }

    /**
     * Base index within `data` for the i-th declaration record.
     *
     * @param dataOffset Base offset for declaration-list data.
     * @param i Declaration index (0-based).
     *
     * @returns Base index in `data`.
     */
    public static declBase(dataOffset: number, i: number): number {
        return dataOffset + DL_HEADER_SIZE + i * DECL_STRIDE;
    }

    /**
     * Property name start offset for the i-th declaration.
     *
     * @param data Output buffer.
     * @param dataOffset Base offset.
     * @param i Declaration index.
     *
     * @returns Source start offset of property name.
     */
    public static propertyStart(data: Int32Array, dataOffset: number, i: number): number {
        return data[dataOffset + DL_HEADER_SIZE + i * DECL_STRIDE + DECL_FIELD_PROPERTY_START];
    }

    /**
     * Property name end offset for the i-th declaration.
     *
     * @param data Output buffer.
     * @param dataOffset Base offset.
     * @param i Declaration index.
     *
     * @returns Source end offset of property name.
     */
    public static propertyEnd(data: Int32Array, dataOffset: number, i: number): number {
        return data[dataOffset + DL_HEADER_SIZE + i * DECL_STRIDE + DECL_FIELD_PROPERTY_END];
    }

    /**
     * Value start offset for the i-th declaration.
     *
     * @param data Output buffer.
     * @param dataOffset Base offset.
     * @param i Declaration index.
     *
     * @returns Source start offset of trimmed value.
     */
    public static valueStart(data: Int32Array, dataOffset: number, i: number): number {
        return data[dataOffset + DL_HEADER_SIZE + i * DECL_STRIDE + DECL_FIELD_VALUE_START];
    }

    /**
     * Value end offset for the i-th declaration.
     *
     * @param data Output buffer.
     * @param dataOffset Base offset.
     * @param i Declaration index.
     *
     * @returns Source end offset of trimmed value.
     */
    public static valueEnd(data: Int32Array, dataOffset: number, i: number): number {
        return data[dataOffset + DL_HEADER_SIZE + i * DECL_STRIDE + DECL_FIELD_VALUE_END];
    }

    /**
     * Important flag for the i-th declaration.
     *
     * @param data Output buffer.
     * @param dataOffset Base offset.
     * @param i Declaration index.
     *
     * @returns 1 if important, 0 otherwise.
     */
    public static important(data: Int32Array, dataOffset: number, i: number): number {
        return data[dataOffset + DL_HEADER_SIZE + i * DECL_STRIDE + DECL_FIELD_IMPORTANT];
    }

    /**
     * Full declaration end offset for the i-th declaration, including the
     * `!important` suffix when present.
     *
     * @param data Output buffer.
     * @param dataOffset Base offset.
     * @param i Declaration index.
     *
     * @returns Source end offset of the full declaration.
     */
    public static declEnd(data: Int32Array, dataOffset: number, i: number): number {
        return data[dataOffset + DL_HEADER_SIZE + i * DECL_STRIDE + DECL_FIELD_DECL_END];
    }
}
