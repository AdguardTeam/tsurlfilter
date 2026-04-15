/* eslint-disable no-param-reassign */

/**
 * @file Attribute selector handler for the CSS selector list preparser.
 *
 * Handles attribute selectors (`[attr]`, `[attr=val]`, `[attr~="val" i]`,
 * etc.). Parses the full `[…]` region atomically, extracting name, optional
 * operator, optional value (quoted or unquoted), and optional case flag.
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
 * Skip whitespace tokens (Whitespace or LineBreak) forward.
 *
 * @param types Token types buffer.
 * @param ti Start token index.
 * @param endTi Exclusive end token index.
 *
 * @returns Token index of the first non-whitespace token, or `endTi`.
 */
function skipWsTokens(types: Uint8Array, ti: number, endTi: number): number {
    let i = ti;
    while (i < endTi && isCssWhitespace(types[i])) {
        i += 1;
    }
    return i;
}

/**
 * Handle an attribute selector (`[name]`, `[name=val]`, etc.) starting at
 * token `ti`.
 *
 * Token `ti` must be an `OpenSquare` token. Scans forward to the matching
 * `CloseSquare`, parsing the name, optional operator, optional value
 * (quoted via {@link cssStringLength} or unquoted via
 * {@link cssIdentSequenceLength}), and optional case flag. Writes one
 * AttributeSelector child record into `ctx.data`.
 *
 * Value offsets for quoted values exclude the surrounding quote characters.
 * Fields with no content are set to {@link NO_VALUE}.
 *
 * @param ctx Preparser context.
 * @param ti Token index of the `[` token.
 * @param endTi Exclusive end token index for the current parsing region.
 * @param dataOffset Base offset within `ctx.data` for selector-list data.
 * @param maxComplex Maximum complex selector capacity (used to locate child array).
 * @param childIndex Index of the child record to write.
 *
 * @returns Token index of the first token after the consumed `]`.
 */
export function handleAttributeSelector(
    ctx: PreparserContext,
    ti: number,
    endTi: number,
    dataOffset: number,
    maxComplex: number,
    childIndex: number,
): number {
    const {
        types, ends, source, sourceStart, data,
    } = ctx;

    const srcStart = tokenStart(ctx, ti);

    // Skip '[' token
    let i = ti + 1;
    i = skipWsTokens(types, i, endTi);

    if (i >= endTi) {
        throw new AdblockSyntaxError(
            'Expected attribute name',
            srcStart,
            srcStart + 1,
        );
    }

    // Parse attribute name (must be a CSS ident)
    const nameStart = tokenStart(ctx, i);
    const nameLen = cssIdentSequenceLength(types, i, endTi, source, ends, sourceStart);
    if (nameLen === 0) {
        throw new AdblockSyntaxError(
            'Expected attribute name identifier',
            nameStart,
            ends[i],
        );
    }
    i += nameLen;
    const nameEnd = ends[i - 1];

    i = skipWsTokens(types, i, endTi);

    let operatorStart = NO_VALUE;
    let operatorEnd = NO_VALUE;
    let valueStart = NO_VALUE;
    let valueEnd = NO_VALUE;
    let flagStart = NO_VALUE;
    let flagEnd = NO_VALUE;

    if (i < endTi && types[i] !== TokenType.CloseSquare) {
        // Parse operator: =, ~=, |=, ^=, $=, *=
        const opTokenStart = tokenStart(ctx, i);
        let opLen: number;

        if (types[i] === TokenType.EqualsSign) {
            opLen = 1;
        } else if (
            (
                types[i] === TokenType.Tilde
                || types[i] === TokenType.Pipe
                || types[i] === TokenType.Caret
                || types[i] === TokenType.DollarSign
                || types[i] === TokenType.Asterisk
            )
            && i + 1 < endTi
            && types[i + 1] === TokenType.EqualsSign
        ) {
            opLen = 2;
        } else {
            throw new AdblockSyntaxError(
                'Invalid attribute selector operator',
                opTokenStart,
                ends[i],
            );
        }

        operatorStart = opTokenStart;
        operatorEnd = ends[i + opLen - 1];
        i += opLen;

        i = skipWsTokens(types, i, endTi);

        if (i >= endTi || types[i] === TokenType.CloseSquare) {
            throw new AdblockSyntaxError(
                'Expected attribute selector value after operator',
                operatorEnd,
                operatorEnd + 1,
            );
        }

        // Parse value: quoted string or unquoted ident
        const strLen = cssStringLength(types, i, endTi);
        if (strLen > 0) {
            // Quoted value: exclude surrounding quotes
            const rawStart = tokenStart(ctx, i);
            const rawEnd = ends[i + strLen - 1];
            valueStart = rawStart + 1; // exclude opening quote
            valueEnd = rawEnd - 1; // exclude closing quote
            i += strLen;
        } else {
            const identLen = cssIdentSequenceLength(types, i, endTi, source, ends, sourceStart);
            if (identLen === 0) {
                throw new AdblockSyntaxError(
                    'Expected attribute selector value',
                    tokenStart(ctx, i),
                    ends[i],
                );
            }
            valueStart = tokenStart(ctx, i);
            valueEnd = ends[i + identLen - 1];
            i += identLen;
        }

        i = skipWsTokens(types, i, endTi);

        // Optional case flag: must be exactly one of i, I, s, S
        if (i < endTi && types[i] !== TokenType.CloseSquare) {
            const flagTokenStart = tokenStart(ctx, i);
            const flagLen = cssIdentSequenceLength(types, i, endTi, source, ends, sourceStart);
            if (flagLen === 0) {
                throw new AdblockSyntaxError(
                    'Expected ] or case flag after attribute value',
                    flagTokenStart,
                    ends[i],
                );
            }
            const flagText = source.slice(flagTokenStart, ends[i + flagLen - 1]);
            if (flagText !== 'i' && flagText !== 'I' && flagText !== 's' && flagText !== 'S') {
                throw new AdblockSyntaxError(
                    `Invalid attribute selector flag '${flagText}': expected i, I, s, or S`,
                    flagTokenStart,
                    ends[i + flagLen - 1],
                );
            }
            flagStart = flagTokenStart;
            flagEnd = ends[i + flagLen - 1];
            i += flagLen;

            i = skipWsTokens(types, i, endTi);
        }
    }

    // Expect closing ']'
    if (i >= endTi || types[i] !== TokenType.CloseSquare) {
        throw new AdblockSyntaxError(
            'Missing ] in attribute selector',
            srcStart,
            srcStart + 1,
        );
    }

    const srcEnd = ends[i];
    i += 1; // consume ']'

    const base = dataOffset + SL_HEADER_SIZE + maxComplex * COMPLEX_STRIDE + childIndex * CHILD_STRIDE;

    data[base + CHILD_FIELD_KIND] = ChildKind.AttributeSelector;
    data[base + CHILD_FIELD_SOURCE_START] = srcStart;
    data[base + CHILD_FIELD_SOURCE_END] = srcEnd;
    data[base + CHILD_FIELD_0] = nameStart; // name_start
    data[base + CHILD_FIELD_1] = nameEnd; // name_end
    data[base + CHILD_FIELD_2] = operatorStart; // operator_start
    data[base + CHILD_FIELD_3] = operatorEnd; // operator_end
    data[base + CHILD_FIELD_4] = valueStart; // value_start
    data[base + CHILD_FIELD_5] = valueEnd; // value_end
    data[base + CHILD_FIELD_6] = flagStart; // flag_start
    data[base + CHILD_FIELD_7] = flagEnd; // flag_end

    return i;
}
