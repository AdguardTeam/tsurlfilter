/* eslint-disable jsdoc/require-description-complete-sentence */
/**
 * @file Simple comment parser.
 *
 * Handles `! text` and `# text` rules.
 * Records the marker source offset and the trimmed text bounds in `ctx.data`.
 *
 * ## Data Layout
 * [0] KIND - CommentKind.Simple
 * [1] MARKER_START - Source offset of ! or # marker
 * [2] TEXT_START - Start of text (after marker + whitespace)
 * [3] TEXT_END - End of text (trailing whitespace trimmed).
 */

import type { ParserContext } from '../context';
import { lastNonWs, skipWs, tokenStart } from '../context';
import type { StructuralParser } from '../types';

import { CM_KIND, CommentKind } from './types';

/**
 * Buffer offset: marker position (! Or #).
 */
export const CM_SIMPLE_MARKER_OFFSET = 1;

/**
 * Buffer offset: start of text (after marker and whitespace).
 */
export const CM_SIMPLE_TEXT_START_OFFSET = 2;

/**
 * Buffer offset: end of text (trailing whitespace trimmed).
 */
export const CM_SIMPLE_TEXT_END_OFFSET = 3;

/**
 * Parser for simple comment rules (`! Text` and `# text`).
 */
export class SimpleCommentParser implements StructuralParser {
    /**
     * Fills `ctx.data` with simple-comment structural indices.
     *
     * @param ctx Parser context (tokenizer output must be loaded).
     * @param startTi Inclusive start token index. Defaults to 0.
     * @param endTi Exclusive end token index. Defaults to ctx.tokenCount.
     * @param dataOffset Offset within ctx.data to write output. Defaults to 0.
     */
    public static parse(ctx: ParserContext, startTi = 0, endTi = ctx.tokenCount, dataOffset = 0): void {
        const { data } = ctx;

        let ti = skipWs(ctx, startTi);

        // Marker: single `!` or `#` character
        const markerStart = tokenStart(ctx, ti);

        ti += 1;

        // Skip optional whitespace after marker
        ti = skipWs(ctx, ti);

        const textStart = ti < endTi
            ? tokenStart(ctx, ti)
            : ctx.ends[endTi - 1]; // empty text: point past the marker

        // Text end: last non-whitespace token's end position
        const lastTi = lastNonWs(ctx, ti, endTi);
        const textEnd = lastTi >= 0 ? ctx.ends[lastTi] : textStart;

        data[dataOffset + CM_KIND] = CommentKind.Simple;
        data[dataOffset + CM_SIMPLE_MARKER_OFFSET] = markerStart;
        data[dataOffset + CM_SIMPLE_TEXT_START_OFFSET] = textStart;
        data[dataOffset + CM_SIMPLE_TEXT_END_OFFSET] = textEnd;
    }

    /**
     * Returns the source offset of the comment marker (`!` or `#`).
     *
     * @param data Buffer written by `parse`.
     *
     * @returns Source offset of the marker character.
     */
    public static markerStart(data: Int32Array): number {
        return data[CM_SIMPLE_MARKER_OFFSET];
    }

    /**
     * Returns the source start of the comment text (after marker + whitespace).
     *
     * @param data Buffer written by `parse`.
     *
     * @returns Source start offset of the text.
     */
    public static textStart(data: Int32Array): number {
        return data[CM_SIMPLE_TEXT_START_OFFSET];
    }

    /**
     * Returns the exclusive source end of the comment text (trailing whitespace trimmed).
     *
     * @param data Buffer written by `parse`.
     *
     * @returns Source end offset of the text.
     */
    public static textEnd(data: Int32Array): number {
        return data[CM_SIMPLE_TEXT_END_OFFSET];
    }
}
