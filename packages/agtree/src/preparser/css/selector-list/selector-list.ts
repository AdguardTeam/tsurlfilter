/* eslint-disable no-bitwise, no-param-reassign */

/**
 * @file CSS selector list preparser — top-level dispatcher.
 *
 * `SelectorListPreparser.preparse()` consumes adblock tokens directly (no
 * `CssTokenStream`, no `@adguard/css-tokenizer`) and writes structural offset
 * records to a region of `ctx.data` with zero heap allocations.
 *
 * Architecture:
 *   - One complex-selector record per comma-separated entry.
 *   - One child record per simple selector or combinator.
 *   - Fixed strides for O(1) random index access.
 *   - Descendant combinators are emitted inline; explicit combinators (`>`,
 *     `+`, `~`) are emitted via `handleCombinator`.
 *
 * @see {@link https://www.w3.org/TR/selectors-4/#selector-list}
 */

import { cssIdentSequenceLength } from '../../../css/tokenizer/css-token-mapping';
import { isCssIdentStart, isCssWhitespace } from '../../../css/tokenizer/css-token-utils';
import { AdblockSyntaxError } from '../../../errors/adblock-syntax-error';
import { CHAR_GREATER_THAN } from '../../../tokenizer/char-codes';
import { TokenType } from '../../../tokenizer/token-types';
import type { PreparserContext } from '../../context';
import { tokenStart } from '../../context';

import { handleAttributeSelector } from './attribute-selector';
import { handleClassSelector } from './class-selector';
import { handleCombinator } from './combinator';
import {
    CHILD_FIELD_KIND,
    CHILD_STRIDE,
    ChildKind,
    COMBINATOR_CHILD,
    COMBINATOR_DESCENDANT,
    COMBINATOR_NEXT_SIBLING,
    COMBINATOR_SUBSEQUENT_SIBLING,
    COMPLEX_FIELD_CHILD_COUNT,
    COMPLEX_FIELD_SOURCE_END,
    COMPLEX_FIELD_SOURCE_START,
    COMPLEX_STRIDE,
    DEFAULT_MAX_CHILDREN,
    DEFAULT_MAX_COMPLEX,
    SL_COUNT_OFFSET,
    SL_FLAGS_OFFSET,
    SL_HEADER_SIZE,
    SL_MIN_DATA_SLOTS,
} from './constants';
import { handleIdSelector } from './id-selector';
import { handlePseudoClassSelector } from './pseudo-class-selector';
import { handleTypeSelector } from './type-selector';

/**
 * CSS selector list preparser.
 *
 * Performs a single-pass structural analysis of a CSS selector list encoded
 * as adblock tokens. Writes all output to `ctx.data` with zero heap
 * allocations.
 */
export class SelectorListPreparser {
    /**
     * Minimum `ctx.data` capacity required for the default configuration.
     */
    public static readonly MIN_DATA_SLOTS = SL_MIN_DATA_SLOTS;

    /**
     * Preparse a CSS selector list token range.
     *
     * Reads tokens from `ctx.types`/`ctx.ends` in the range
     * `[startTi, endTi)` and writes:
     *   - A 2-slot header at `dataOffset`.
     *   - Up to `maxComplex` complex selector records at
     *     `dataOffset + SL_HEADER_SIZE`.
     *   - Up to `maxChildren` child records (simple selectors + combinators)
     *     after all complex selector records.
     *
     * @param ctx Preparser context.
     * @param startTi Inclusive start token index.
     * @param endTi Exclusive end token index (use `ctx.tokenCount` for all tokens).
     * @param dataOffset Offset within `ctx.data` to start writing.
     * @param maxComplex Maximum supported complex selectors (default 8).
     * @param maxChildren Maximum supported child records (default 64).
     *
     * @throws {AdblockSyntaxError} On any structural syntax error.
     */
    public static preparse(
        ctx: PreparserContext,
        startTi: number,
        endTi: number,
        dataOffset: number,
        maxComplex: number = DEFAULT_MAX_COMPLEX,
        maxChildren: number = DEFAULT_MAX_CHILDREN,
    ): void {
        const {
            types,
            ends,
            source,
            sourceStart,
        } = ctx;

        let complexCount = 0; // number of complex selectors completed so far
        let totalChildCount = 0; // global child record index
        let childCountInComplex = 0; // children in the current complex selector
        let complexSourceStart = 0; // source start of current complex selector
        let complexSourceEnd = 0; // source end of last child in current complex selector
        let lastChildKind = -1; // ChildKind of last child, or -1 if none
        let hasTypeSelectorInCompound = false; // type selector seen in current compound?

        // Skip leading whitespace
        let ti = startTi;
        while (ti < endTi && isCssWhitespace(types[ti])) {
            ti += 1;
        }

        if (ti >= endTi) {
            throw new AdblockSyntaxError(
                'Empty selector',
                sourceStart,
                sourceStart + 1,
            );
        }

        complexSourceStart = tokenStart(ctx, ti);

        // Main dispatch loop
        while (ti < endTi) {
            const tt = types[ti];

            // Whitespace: potential descendant combinator or formatting
            if (isCssWhitespace(tt)) {
                const wsSrcStart = tokenStart(ctx, ti);
                const wsSrcEnd = ends[ti];
                ti += 1; // advance past whitespace token

                if (ti >= endTi) {
                    // Trailing whitespace — ignore
                    break;
                }

                const nextTt = types[ti];

                // Whitespace before comma: skip silently
                if (nextTt === TokenType.Comma) {
                    continue;
                }

                // Whitespace before explicit combinator: skip silently
                if (
                    nextTt === TokenType.PlusSign
                    || nextTt === TokenType.Tilde
                    || (
                        nextTt === TokenType.Symbol
                        && source.charCodeAt(ti > 0 ? ends[ti - 1] : sourceStart) === CHAR_GREATER_THAN
                    )
                ) {
                    continue;
                }

                // Whitespace after an explicit combinator: skip silently
                if (lastChildKind === ChildKind.SelectorCombinator) {
                    continue;
                }

                // No child written yet in this complex selector: skip silently
                // (handles theoretical edge case of leading whitespace reaching here)
                if (lastChildKind === -1) {
                    complexSourceStart = tokenStart(ctx, ti);
                    continue;
                }

                // Descendant combinator
                if (totalChildCount >= maxChildren) {
                    throw new AdblockSyntaxError(
                        'Selector list exceeds maximum child record capacity',
                        wsSrcStart,
                        wsSrcEnd,
                    );
                }

                handleCombinator(
                    ctx,
                    ti - 1, // whitespace token index (not advanced yet in combinator)
                    dataOffset,
                    maxComplex,
                    totalChildCount,
                    COMBINATOR_DESCENDANT,
                    wsSrcStart,
                    wsSrcEnd,
                );
                complexSourceEnd = wsSrcEnd;
                totalChildCount += 1;
                childCountInComplex += 1;
                lastChildKind = ChildKind.SelectorCombinator;
                hasTypeSelectorInCompound = false;
                continue;
            }

            // Comma: end of current complex selector
            if (tt === TokenType.Comma) {
                if (childCountInComplex === 0) {
                    throw new AdblockSyntaxError(
                        'Empty selector in selector list',
                        tokenStart(ctx, ti),
                        ends[ti],
                    );
                }
                if (lastChildKind === ChildKind.SelectorCombinator) {
                    throw new AdblockSyntaxError(
                        'Trailing combinator before comma in selector list',
                        tokenStart(ctx, ti),
                        ends[ti],
                    );
                }

                // Capacity guard before writing to avoid overwriting child-record region
                if (complexCount >= maxComplex) {
                    throw new AdblockSyntaxError(
                        'Selector list exceeds maximum complex selector capacity',
                        tokenStart(ctx, ti),
                        ends[ti],
                    );
                }

                // Write complex selector record
                SelectorListPreparser.writeComplexRecord(
                    ctx.data,
                    dataOffset,
                    complexCount,
                    childCountInComplex,
                    complexSourceStart,
                    complexSourceEnd,
                );

                complexCount += 1;

                // Reset state for next complex selector
                childCountInComplex = 0;
                hasTypeSelectorInCompound = false;
                lastChildKind = -1;

                ti += 1; // skip ','

                // Skip whitespace after comma
                while (ti < endTi && isCssWhitespace(types[ti])) {
                    ti += 1;
                }

                if (ti >= endTi) {
                    throw new AdblockSyntaxError(
                        'Empty selector after comma in selector list',
                        ends[ti - 1],
                        ends[ti - 1] + 1,
                    );
                }

                complexSourceStart = tokenStart(ctx, ti);
                // Do not advance ti; fall through to process next token
                continue;
            }

            // Capacity guard
            if (totalChildCount >= maxChildren) {
                throw new AdblockSyntaxError(
                    'Selector list exceeds maximum child record capacity',
                    tokenStart(ctx, ti),
                    ends[ti],
                );
            }

            // Type selector: ident sequence or universal selector (*)
            if (
                tt === TokenType.Asterisk
                || isCssIdentStart(tt)
                || tt === TokenType.Hyphen
                || tt === TokenType.Escaped
            ) {
                // Attempt to match a CSS ident sequence (or '*' universal selector)
                if (tt !== TokenType.Asterisk) {
                    const len = cssIdentSequenceLength(types, ti, endTi, source, ends, sourceStart);
                    if (len === 0) {
                        // Starts with Hyphen/Escaped but is not a valid CSS ident
                        throw new AdblockSyntaxError(
                            `Unexpected token in selector: '${source.slice(tokenStart(ctx, ti), ends[ti])}'`,
                            tokenStart(ctx, ti),
                            ends[ti],
                        );
                    }
                }

                // Validate compound-selector position constraints
                if (hasTypeSelectorInCompound) {
                    throw new AdblockSyntaxError(
                        'Type selector is already set for the compound selector',
                        tokenStart(ctx, ti),
                        ends[ti],
                    );
                }
                if (lastChildKind !== -1 && lastChildKind !== ChildKind.SelectorCombinator) {
                    throw new AdblockSyntaxError(
                        'Type selector must be first in the compound selector',
                        tokenStart(ctx, ti),
                        ends[ti],
                    );
                }

                const nextTi = handleTypeSelector(ctx, ti, endTi, dataOffset, maxComplex, totalChildCount);
                complexSourceEnd = ends[nextTi - 1];
                totalChildCount += 1;
                childCountInComplex += 1;
                lastChildKind = ChildKind.TypeSelector;
                hasTypeSelectorInCompound = true;
                ti = nextTi;
                continue;
            }

            // ID selector
            if (tt === TokenType.HashMark) {
                const nextTi = handleIdSelector(ctx, ti, endTi, dataOffset, maxComplex, totalChildCount);
                complexSourceEnd = ends[nextTi - 1];
                totalChildCount += 1;
                childCountInComplex += 1;
                lastChildKind = ChildKind.IdSelector;
                ti = nextTi;
                continue;
            }

            // Class selector
            if (tt === TokenType.Dot) {
                const nextTi = handleClassSelector(ctx, ti, endTi, dataOffset, maxComplex, totalChildCount);
                complexSourceEnd = ends[nextTi - 1];
                totalChildCount += 1;
                childCountInComplex += 1;
                lastChildKind = ChildKind.ClassSelector;
                ti = nextTi;
                continue;
            }

            // Attribute selector
            if (tt === TokenType.OpenSquare) {
                const nextTi = handleAttributeSelector(ctx, ti, endTi, dataOffset, maxComplex, totalChildCount);
                complexSourceEnd = ends[nextTi - 1];
                totalChildCount += 1;
                childCountInComplex += 1;
                lastChildKind = ChildKind.AttributeSelector;
                ti = nextTi;
                continue;
            }

            // Pseudo-class selector
            if (tt === TokenType.Colon) {
                const nextTi = handlePseudoClassSelector(ctx, ti, endTi, dataOffset, maxComplex, totalChildCount);
                complexSourceEnd = ends[nextTi - 1];
                totalChildCount += 1;
                childCountInComplex += 1;
                lastChildKind = ChildKind.PseudoClassSelector;
                ti = nextTi;
                continue;
            }

            // Explicit combinators: +, ~, >
            if (
                tt === TokenType.PlusSign
                || tt === TokenType.Tilde
                || (
                    tt === TokenType.Symbol
                    && source.charCodeAt(tokenStart(ctx, ti)) === CHAR_GREATER_THAN
                )
            ) {
                if (lastChildKind === -1) {
                    throw new AdblockSyntaxError(
                        'Combinator at the start of a selector',
                        tokenStart(ctx, ti),
                        ends[ti],
                    );
                }
                if (lastChildKind === ChildKind.SelectorCombinator) {
                    throw new AdblockSyntaxError(
                        'Consecutive combinators in selector',
                        tokenStart(ctx, ti),
                        ends[ti],
                    );
                }

                let combinatorValue: number;
                if (tt === TokenType.PlusSign) {
                    combinatorValue = COMBINATOR_NEXT_SIBLING;
                } else if (tt === TokenType.Tilde) {
                    combinatorValue = COMBINATOR_SUBSEQUENT_SIBLING;
                } else {
                    combinatorValue = COMBINATOR_CHILD;
                }

                const cSrcStart = tokenStart(ctx, ti);
                const cSrcEnd = ends[ti];

                handleCombinator(
                    ctx,
                    ti,
                    dataOffset,
                    maxComplex,
                    totalChildCount,
                    combinatorValue,
                    cSrcStart,
                    cSrcEnd,
                );
                complexSourceEnd = cSrcEnd;
                totalChildCount += 1;
                childCountInComplex += 1;
                lastChildKind = ChildKind.SelectorCombinator;
                hasTypeSelectorInCompound = false;
                ti += 1;
                continue;
            }

            // Unexpected token
            throw new AdblockSyntaxError(
                `Unexpected token in selector: '${source.slice(tokenStart(ctx, ti), ends[ti])}'`,
                tokenStart(ctx, ti),
                ends[ti],
            );
        }

        // Finalize last complex selector
        if (childCountInComplex === 0) {
            throw new AdblockSyntaxError(
                'Empty selector',
                sourceStart,
                sourceStart + 1,
            );
        }

        if (lastChildKind === ChildKind.SelectorCombinator) {
            throw new AdblockSyntaxError(
                'Trailing combinator at the end of selector',
                complexSourceEnd,
                complexSourceEnd + 1,
            );
        }

        // Capacity guard before writing to avoid overwriting child-record region
        if (complexCount >= maxComplex) {
            throw new AdblockSyntaxError(
                'Selector list exceeds maximum complex selector capacity',
                complexSourceStart,
                complexSourceEnd,
            );
        }

        SelectorListPreparser.writeComplexRecord(
            ctx.data,
            dataOffset,
            complexCount,
            childCountInComplex,
            complexSourceStart,
            complexSourceEnd,
        );
        complexCount += 1;

        // Write header
        ctx.data[dataOffset + SL_COUNT_OFFSET] = complexCount;
        ctx.data[dataOffset + SL_FLAGS_OFFSET] = 0;
    }

    /**
     * Write a complex selector record at the given index.
     *
     * @param data Output buffer.
     * @param dataOffset Base offset for selector-list data.
     * @param complexIdx Zero-based complex selector index.
     * @param childCount Number of children in this complex selector.
     * @param srcStart Source start offset.
     * @param srcEnd Source end offset.
     */
    private static writeComplexRecord(
        data: Int32Array,
        dataOffset: number,
        complexIdx: number,
        childCount: number,
        srcStart: number,
        srcEnd: number,
    ): void {
        const base = dataOffset + SL_HEADER_SIZE + complexIdx * COMPLEX_STRIDE;
        data[base + COMPLEX_FIELD_CHILD_COUNT] = childCount;
        data[base + COMPLEX_FIELD_SOURCE_START] = srcStart;
        data[base + COMPLEX_FIELD_SOURCE_END] = srcEnd;
    }

    /**
     * Number of complex selectors in the preparsed selector list.
     *
     * @param data Output buffer.
     * @param dataOffset Base offset for selector-list data.
     *
     * @returns Complex selector count.
     */
    public static complexCount(data: Int32Array, dataOffset: number): number {
        return data[dataOffset + SL_COUNT_OFFSET];
    }

    /**
     * Number of children (simple selectors + combinators) in a complex selector.
     *
     * @param data Output buffer.
     * @param dataOffset Base offset for selector-list data.
     * @param complexIdx Zero-based complex selector index.
     *
     * @returns Child count for that complex selector.
     */
    public static childCountInComplex(
        data: Int32Array,
        dataOffset: number,
        complexIdx: number,
    ): number {
        const base = dataOffset + SL_HEADER_SIZE + complexIdx * COMPLEX_STRIDE;
        return data[base + COMPLEX_FIELD_CHILD_COUNT];
    }

    /**
     * Source start offset of a complex selector.
     *
     * @param data Output buffer.
     * @param dataOffset Base offset for selector-list data.
     * @param complexIdx Zero-based complex selector index.
     *
     * @returns Source start offset.
     */
    public static complexSourceStart(
        data: Int32Array,
        dataOffset: number,
        complexIdx: number,
    ): number {
        const base = dataOffset + SL_HEADER_SIZE + complexIdx * COMPLEX_STRIDE;
        return data[base + COMPLEX_FIELD_SOURCE_START];
    }

    /**
     * Source end offset of a complex selector.
     *
     * @param data Output buffer.
     * @param dataOffset Base offset for selector-list data.
     * @param complexIdx Zero-based complex selector index.
     *
     * @returns Source end offset.
     */
    public static complexSourceEnd(
        data: Int32Array,
        dataOffset: number,
        complexIdx: number,
    ): number {
        const base = dataOffset + SL_HEADER_SIZE + complexIdx * COMPLEX_STRIDE;
        return data[base + COMPLEX_FIELD_SOURCE_END];
    }

    /**
     * Global child start index for a complex selector.
     *
     * Sums child counts of all preceding complex selectors to find the index
     * of the first child of `complexIdx` in the flat child array.
     *
     * **Complexity**: O(complexIdx) — not O(1). For typical selector lists
     * (≤ 8 complex selectors) this is negligible, but callers should not use
     * this in tight inner loops over large lists.
     *
     * @param data Output buffer.
     * @param dataOffset Base offset for selector-list data.
     * @param complexIdx Zero-based complex selector index.
     *
     * @returns Global child index of the first child for `complexIdx`.
     */
    public static childStartIndex(
        data: Int32Array,
        dataOffset: number,
        complexIdx: number,
    ): number {
        let start = 0;
        for (let i = 0; i < complexIdx; i += 1) {
            const base = dataOffset + SL_HEADER_SIZE + i * COMPLEX_STRIDE;
            start += data[base + COMPLEX_FIELD_CHILD_COUNT];
        }
        return start;
    }

    /**
     * Base address of a child record in `data`.
     *
     * @param dataOffset Base offset for selector-list data.
     * @param maxComplex Maximum complex selector capacity.
     * @param childIdx Global zero-based child record index.
     *
     * @returns Absolute index into `data` for the first field of the child record.
     */
    public static childBase(
        dataOffset: number,
        maxComplex: number,
        childIdx: number,
    ): number {
        return dataOffset + SL_HEADER_SIZE + maxComplex * COMPLEX_STRIDE + childIdx * CHILD_STRIDE;
    }

    /**
     * ChildKind discriminator for a child record.
     *
     * @param data Output buffer.
     * @param dataOffset Base offset for selector-list data.
     * @param maxComplex Maximum complex selector capacity.
     * @param childIdx Global zero-based child record index.
     *
     * @returns `ChildKind` value.
     */
    public static childKind(
        data: Int32Array,
        dataOffset: number,
        maxComplex: number,
        childIdx: number,
    ): ChildKind {
        const base = SelectorListPreparser.childBase(dataOffset, maxComplex, childIdx);
        return data[base + CHILD_FIELD_KIND] as ChildKind;
    }
}
