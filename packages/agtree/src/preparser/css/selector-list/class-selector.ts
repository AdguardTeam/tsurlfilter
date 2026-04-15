/* eslint-disable no-param-reassign */

/**
 * @file Class selector handler for the CSS selector list preparser.
 *
 * Handles class selectors (`.class`). The `.` (Dot) token is followed by a
 * CSS ident sequence consumed via {@link cssIdentSequenceLength}.
 */

import { cssIdentSequenceLength } from '../../../css/tokenizer/css-token-mapping';
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
 * Handle a class selector (`.class`) starting at token `ti`.
 *
 * Token `ti` must be a `Dot` token. Reads the dot and the subsequent CSS
 * ident sequence and writes one ClassSelector child record into `ctx.data`.
 *
 * The value offsets exclude the leading `.` character.
 *
 * @param ctx Preparser context.
 * @param ti Token index of the `.` token.
 * @param endTi Exclusive end token index for the current parsing region.
 * @param dataOffset Base offset within `ctx.data` for selector-list data.
 * @param maxComplex Maximum complex selector capacity (used to locate child array).
 * @param childIndex Index of the child record to write.
 *
 * @returns Token index of the first token after the consumed selector.
 */
export function handleClassSelector(
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

    // Skip the '.' token
    const identStart = ti + 1;
    if (identStart >= endTi) {
        throw new AdblockSyntaxError(
            'Empty class selector: expected identifier after .',
            srcStart,
            srcStart + 1,
        );
    }

    const identLen = cssIdentSequenceLength(types, identStart, endTi, source, ends, sourceStart);
    if (identLen === 0) {
        throw new AdblockSyntaxError(
            'Invalid class selector: expected identifier after .',
            tokenStart(ctx, identStart),
            ends[identStart],
        );
    }

    const srcEnd = ends[identStart + identLen - 1];

    // Value excludes the '.' character (value starts at end of Dot token)
    const valueStart = ends[ti];
    const valueEnd = srcEnd;

    const base = dataOffset + SL_HEADER_SIZE + maxComplex * COMPLEX_STRIDE + childIndex * CHILD_STRIDE;

    data[base + CHILD_FIELD_KIND] = ChildKind.ClassSelector;
    data[base + CHILD_FIELD_SOURCE_START] = srcStart;
    data[base + CHILD_FIELD_SOURCE_END] = srcEnd;
    data[base + CHILD_FIELD_0] = valueStart; // value_start (exclude '.')
    data[base + CHILD_FIELD_1] = valueEnd; // value_end
    data[base + CHILD_FIELD_2] = NO_VALUE;
    data[base + CHILD_FIELD_3] = NO_VALUE;
    data[base + CHILD_FIELD_4] = NO_VALUE;
    data[base + CHILD_FIELD_5] = NO_VALUE;
    data[base + CHILD_FIELD_6] = NO_VALUE;
    data[base + CHILD_FIELD_7] = NO_VALUE;

    return identStart + identLen;
}
