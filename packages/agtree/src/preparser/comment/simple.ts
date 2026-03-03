/**
 * @file Simple comment preparser.
 *
 * Handles `! text` and `# text` rules. Records the marker source offset and
 * the trimmed text bounds in `ctx.data`.
 */

import type { PreparserContext } from '../context';
import { skipWs, tokenStart } from '../context';
import {
    CM_KIND,
    CM_SIMPLE_MARKER,
    CM_SIMPLE_TEXT_END,
    CM_SIMPLE_TEXT_START,
    CommentKind,
} from './types';

/**
 * Preparser for simple comment rules (`! text` and `# text`).
 */
export class SimpleCommentPreparser {
    /**
     * Fills `ctx.data` with simple-comment structural indices.
     *
     * @param ctx Preparser context (tokenizer output must be loaded).
     */
    public static preparse(ctx: PreparserContext): void {
        const { data, source } = ctx;

        let ti = skipWs(ctx, 0);

        // Marker: single `!` or `#` character
        const markerStart = tokenStart(ctx, ti);

        ti += 1;

        // Skip optional whitespace after marker
        ti = skipWs(ctx, ti);

        const textStart = ti < ctx.tokenCount
            ? tokenStart(ctx, ti)
            : ctx.ends[ctx.tokenCount - 1]; // empty text: point past the marker

        // Text end: trim trailing whitespace from the source string
        let textEnd = source.length;

        while (textEnd > textStart && (source[textEnd - 1] === ' ' || source[textEnd - 1] === '\t')) {
            textEnd -= 1;
        }

        data[CM_KIND] = CommentKind.Simple;
        data[CM_SIMPLE_MARKER] = markerStart;
        data[CM_SIMPLE_TEXT_START] = textStart;
        data[CM_SIMPLE_TEXT_END] = textEnd;
    }

    /**
     * Returns the source offset of the comment marker (`!` or `#`).
     *
     * @param data Buffer written by `preparse`.
     * @returns Source offset of the marker character.
     */
    public static markerStart(data: Int32Array): number {
        return data[CM_SIMPLE_MARKER];
    }

    /**
     * Returns the source start of the comment text (after marker + whitespace).
     *
     * @param data Buffer written by `preparse`.
     * @returns Source start offset of the text.
     */
    public static textStart(data: Int32Array): number {
        return data[CM_SIMPLE_TEXT_START];
    }

    /**
     * Returns the exclusive source end of the comment text (trailing whitespace trimmed).
     *
     * @param data Buffer written by `preparse`.
     * @returns Source end offset of the text.
     */
    public static textEnd(data: Int32Array): number {
        return data[CM_SIMPLE_TEXT_END];
    }
}
