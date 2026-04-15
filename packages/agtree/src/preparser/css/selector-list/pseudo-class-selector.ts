/* eslint-disable no-param-reassign */

/**
 * @file Pseudo-class selector handler for the CSS selector list preparser.
 *
 * Handles pseudo-class selectors (`:hover`, `:nth-child(2n+1)`,
 * `:not(.class)`, etc.). Uses an integer depth counter to correctly balance
 * nested parentheses and skips CSS string tokens inside arguments.
 */

import { cssIdentSequenceLength, cssStringLength } from '../../../css/tokenizer/css-token-mapping';
import { isCssWhitespace } from '../../../css/tokenizer/css-token-utils';
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
 * Handle a pseudo-class selector (`:hover`, `:nth-child(2n+1)`) starting at
 * token `ti`.
 *
 * Token `ti` must be a `Colon` token. Reads the colon, the pseudo-class name
 * (a CSS ident sequence), and — for functional pseudo-classes — the balanced
 * parenthetical argument. String tokens inside arguments are skipped during
 * balance counting. Argument offsets are trimmed of leading/trailing
 * whitespace tokens.
 *
 * Pseudo-element selectors (`::`) are not supported and throw immediately.
 *
 * @param ctx Preparser context.
 * @param ti Token index of the `:` token.
 * @param endTi Exclusive end token index for the current parsing region.
 * @param dataOffset Base offset within `ctx.data` for selector-list data.
 * @param maxComplex Maximum complex selector capacity (used to locate child array).
 * @param childIndex Index of the child record to write.
 *
 * @returns Token index of the first token after the consumed selector.
 */
export function handlePseudoClassSelector(
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

    // Skip the ':' token
    let i = ti + 1;

    // Reject pseudo-elements ('::')
    if (i < endTi && types[i] === TokenType.Colon) {
        throw new AdblockSyntaxError(
            'Pseudo-element selectors (::) are not supported',
            srcStart,
            ends[i],
        );
    }

    // Parse pseudo-class name (must be a CSS ident)
    if (i >= endTi) {
        throw new AdblockSyntaxError(
            'Empty pseudo-class: expected name after :',
            srcStart,
            srcStart + 1,
        );
    }

    const nameStart = tokenStart(ctx, i);
    const nameLen = cssIdentSequenceLength(types, i, endTi, source, ends, sourceStart);
    if (nameLen === 0) {
        throw new AdblockSyntaxError(
            'Empty pseudo-class: expected identifier after :',
            nameStart,
            ends[i],
        );
    }
    i += nameLen;
    const nameEnd = ends[i - 1];

    let argStart = NO_VALUE;
    let argEnd = NO_VALUE;
    let srcEnd = nameEnd;

    // Check for functional pseudo-class: name followed by '('
    if (i < endTi && types[i] === TokenType.OpenParen) {
        const openParenTi = i;
        i += 1; // skip '('

        // Scan for matching ')' using depth counter
        // Strings are skipped to avoid counting ')' inside quoted content
        const argContentStartTi = i;
        let depth = 1;

        while (i < endTi && depth > 0) {
            const tt = types[i];

            if (tt === TokenType.Quote || tt === TokenType.Apostrophe) {
                // Skip over quoted string
                const strLen = cssStringLength(types, i, endTi);
                i += strLen > 0 ? strLen : 1;
            } else if (tt === TokenType.OpenParen) {
                depth += 1;
                i += 1;
            } else if (tt === TokenType.CloseParen) {
                depth -= 1;
                if (depth === 0) {
                    break;
                }
                i += 1;
            } else {
                i += 1;
            }
        }

        if (depth !== 0) {
            throw new AdblockSyntaxError(
                'Missing ) in pseudo-class functional argument',
                tokenStart(ctx, openParenTi),
                ends[openParenTi],
            );
        }

        // i is now at the matching ')' token
        const argContentEndTi = i; // exclusive end of content (before ')')
        srcEnd = ends[i];
        i += 1; // consume ')'

        // Trim argument content of leading and trailing whitespace
        let trimStart = argContentStartTi;
        let trimEnd = argContentEndTi;

        while (trimStart < trimEnd && isCssWhitespace(types[trimStart])) {
            trimStart += 1;
        }
        while (trimEnd > trimStart && isCssWhitespace(types[trimEnd - 1])) {
            trimEnd -= 1;
        }

        if (trimStart < trimEnd) {
            argStart = tokenStart(ctx, trimStart);
            argEnd = ends[trimEnd - 1];
        } else {
            // Empty argument (all whitespace or empty parens)
            argStart = ends[openParenTi]; // position right after '('
            argEnd = argStart;
        }
    }

    const base = dataOffset + SL_HEADER_SIZE + maxComplex * COMPLEX_STRIDE + childIndex * CHILD_STRIDE;

    data[base + CHILD_FIELD_KIND] = ChildKind.PseudoClassSelector;
    data[base + CHILD_FIELD_SOURCE_START] = srcStart;
    data[base + CHILD_FIELD_SOURCE_END] = srcEnd;
    data[base + CHILD_FIELD_0] = nameStart; // pseudo-class name start
    data[base + CHILD_FIELD_1] = nameEnd; // pseudo-class name end
    data[base + CHILD_FIELD_2] = argStart; // argument start (or NO_VALUE)
    data[base + CHILD_FIELD_3] = argEnd; // argument end (or NO_VALUE)
    data[base + CHILD_FIELD_4] = NO_VALUE;
    data[base + CHILD_FIELD_5] = NO_VALUE;
    data[base + CHILD_FIELD_6] = NO_VALUE;
    data[base + CHILD_FIELD_7] = NO_VALUE;

    return i;
}
