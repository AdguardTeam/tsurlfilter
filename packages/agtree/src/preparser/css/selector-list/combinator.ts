/* eslint-disable no-param-reassign */

/**
 * @file Combinator handler for the CSS selector list preparser.
 *
 * Handles explicit selector combinators: child (`>`), next-sibling (`+`),
 * and subsequent-sibling (`~`). The descendant combinator (whitespace) is
 * handled inline in the main dispatcher (`selector-list.ts`).
 */

import type { PreparserContext } from '../../context';

import {
    CHILD_FIELD_0,
    CHILD_FIELD_1,
    CHILD_FIELD_2,
    CHILD_FIELD_3,
    CHILD_FIELD_4,
    CHILD_FIELD_5,
    CHILD_FIELD_6,
    CHILD_FIELD_7,
    CHILD_FIELD_KIND,
    CHILD_FIELD_SOURCE_END,
    CHILD_FIELD_SOURCE_START,
    CHILD_STRIDE,
    ChildKind,
    COMPLEX_STRIDE,
    NO_VALUE,
    SL_HEADER_SIZE,
} from './constants';

/**
 * Handle an explicit selector combinator (`>`, `+`, or `~`) at token `ti`,
 * or a descendant combinator (whitespace) with the given source range.
 *
 * Writes one SelectorCombinator child record into `ctx.data`.
 *
 * @param ctx Preparser context.
 * @param ti Token index of the combinator token (for explicit combinators)
 *   or the whitespace token (for descendant combinators).
 * @param dataOffset Base offset within `ctx.data` for selector-list data.
 * @param maxComplex Maximum complex selector capacity (used to locate child array).
 * @param childIndex Index of the child record to write.
 * @param combinatorValue Encoded combinator type: one of `COMBINATOR_*` constants.
 * @param srcStart Source start offset of the combinator.
 * @param srcEnd Source end offset of the combinator.
 *
 * @returns Token index of the first token after the consumed combinator.
 */
export function handleCombinator(
    ctx: PreparserContext,
    ti: number,
    dataOffset: number,
    maxComplex: number,
    childIndex: number,
    combinatorValue: number,
    srcStart: number,
    srcEnd: number,
): number {
    const { data } = ctx;

    const base = dataOffset + SL_HEADER_SIZE + maxComplex * COMPLEX_STRIDE + childIndex * CHILD_STRIDE;

    data[base + CHILD_FIELD_KIND] = ChildKind.SelectorCombinator;
    data[base + CHILD_FIELD_SOURCE_START] = srcStart;
    data[base + CHILD_FIELD_SOURCE_END] = srcEnd;
    data[base + CHILD_FIELD_0] = combinatorValue; // combinator type encoding
    data[base + CHILD_FIELD_1] = NO_VALUE;
    data[base + CHILD_FIELD_2] = NO_VALUE;
    data[base + CHILD_FIELD_3] = NO_VALUE;
    data[base + CHILD_FIELD_4] = NO_VALUE;
    data[base + CHILD_FIELD_5] = NO_VALUE;
    data[base + CHILD_FIELD_6] = NO_VALUE;
    data[base + CHILD_FIELD_7] = NO_VALUE;

    // Explicit combinators occupy exactly one token; descendant combinators (whitespace)
    // are a single whitespace token whose end the caller has already advanced past.
    return ti + 1;
}
