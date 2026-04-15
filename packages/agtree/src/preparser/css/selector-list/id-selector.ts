/* eslint-disable no-param-reassign */

/**
 * @file ID selector handler for the CSS selector list preparser.
 *
 * Handles ID selectors (`#id`). Consumes adblock tokens via
 * {@link cssHashLength} for CSS hash-token matching.
 */

import { cssHashLength } from '../../../css/tokenizer/css-token-mapping';
import { AdblockSyntaxError } from '../../../errors/adblock-syntax-error';
import type { PreparserContext } from '../../context';
import { tokenStart } from '../../context';

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
 * Handle an ID selector (`#id`) starting at token `ti`.
 *
 * Token `ti` must be a `HashMark` token. Reads the hash and subsequent
 * ident-code-point tokens via {@link cssHashLength} and writes one
 * IdSelector child record into `ctx.data`.
 *
 * The value offsets exclude the leading `#` character.
 *
 * @param ctx Preparser context.
 * @param ti Token index of the `#` token.
 * @param endTi Exclusive end token index for the current parsing region.
 * @param dataOffset Base offset within `ctx.data` for selector-list data.
 * @param maxComplex Maximum complex selector capacity (used to locate child array).
 * @param childIndex Index of the child record to write.
 *
 * @returns Token index of the first token after the consumed selector.
 */
export function handleIdSelector(
    ctx: PreparserContext,
    ti: number,
    endTi: number,
    dataOffset: number,
    maxComplex: number,
    childIndex: number,
): number {
    const {
        types,
        ends,
        source,
        sourceStart,
        data,
    } = ctx;

    const srcStart = tokenStart(ctx, ti);

    const hashLen = cssHashLength(types, ti, endTi, source, ends, sourceStart);
    if (hashLen === 0) {
        throw new AdblockSyntaxError(
            'Invalid ID selector: expected identifier after #',
            srcStart,
            srcStart + 1,
        );
    }

    const srcEnd = ends[ti + hashLen - 1];

    // Value excludes the '#' character (ends[ti] is exclusive end of '#' token)
    const valueStart = ends[ti];
    const valueEnd = srcEnd;

    const base = dataOffset + SL_HEADER_SIZE + maxComplex * COMPLEX_STRIDE + childIndex * CHILD_STRIDE;

    data[base + CHILD_FIELD_KIND] = ChildKind.IdSelector;
    data[base + CHILD_FIELD_SOURCE_START] = srcStart;
    data[base + CHILD_FIELD_SOURCE_END] = srcEnd;
    data[base + CHILD_FIELD_0] = valueStart; // value_start (exclude '#')
    data[base + CHILD_FIELD_1] = valueEnd; // value_end
    data[base + CHILD_FIELD_2] = NO_VALUE;
    data[base + CHILD_FIELD_3] = NO_VALUE;
    data[base + CHILD_FIELD_4] = NO_VALUE;
    data[base + CHILD_FIELD_5] = NO_VALUE;
    data[base + CHILD_FIELD_6] = NO_VALUE;
    data[base + CHILD_FIELD_7] = NO_VALUE;

    return ti + hashLen;
}
