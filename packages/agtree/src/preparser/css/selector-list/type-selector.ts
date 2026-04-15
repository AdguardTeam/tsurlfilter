/* eslint-disable no-param-reassign */

/**
 * @file Type selector handler for the CSS selector list preparser.
 *
 * Handles type selectors (tag names like `div`, `span`) and the universal
 * selector (`*`). Consumes adblock tokens via `cssIdentSequenceLength` for
 * CSS ident matching.
 */

import { cssIdentSequenceLength } from '../../../css/tokenizer/css-token-mapping';
import { AdblockSyntaxError } from '../../../errors/adblock-syntax-error';
import { TokenType } from '../../../tokenizer/token-types';
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
 * Handle a type selector or universal selector (`*`) starting at token `ti`.
 *
 * Reads an ident sequence (via {@link cssIdentSequenceLength}) or an Asterisk
 * token and writes one TypeSelector child record into `ctx.data`.
 *
 * @param ctx Preparser context.
 * @param ti Token index of the first token of the selector.
 * @param endTi Exclusive end token index for the current parsing region.
 * @param dataOffset Base offset within `ctx.data` for selector-list data.
 * @param maxComplex Maximum complex selector capacity (used to locate child array).
 * @param childIndex Index of the child record to write.
 *
 * @returns Token index of the first token after the consumed selector.
 */
export function handleTypeSelector(
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

    let nextTi: number;
    let srcEnd: number;

    if (types[ti] === TokenType.Asterisk) {
        // Universal selector: single Asterisk token
        nextTi = ti + 1;
        srcEnd = ends[ti];
    } else {
        const len = cssIdentSequenceLength(types, ti, endTi, source, ends, sourceStart);
        if (len === 0) {
            throw new AdblockSyntaxError(
                'Expected type selector name',
                srcStart,
                srcStart + 1,
            );
        }
        nextTi = ti + len;
        srcEnd = ends[ti + len - 1];
    }

    const base = dataOffset + SL_HEADER_SIZE + maxComplex * COMPLEX_STRIDE + childIndex * CHILD_STRIDE;

    data[base + CHILD_FIELD_KIND] = ChildKind.TypeSelector;
    data[base + CHILD_FIELD_SOURCE_START] = srcStart;
    data[base + CHILD_FIELD_SOURCE_END] = srcEnd;
    data[base + CHILD_FIELD_0] = srcStart; // value_start (= source start for type sel)
    data[base + CHILD_FIELD_1] = srcEnd; // value_end
    data[base + CHILD_FIELD_2] = NO_VALUE;
    data[base + CHILD_FIELD_3] = NO_VALUE;
    data[base + CHILD_FIELD_4] = NO_VALUE;
    data[base + CHILD_FIELD_5] = NO_VALUE;
    data[base + CHILD_FIELD_6] = NO_VALUE;
    data[base + CHILD_FIELD_7] = NO_VALUE;

    return nextTi;
}
