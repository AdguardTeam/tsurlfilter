/**
 * @file Metadata comment preparser.
 *
 * Handles `! Header: value` and `# Header: value` rules. Records the marker,
 * header name, and value bounds in `ctx.data`.
 *
 * ## Data Layout
 * [0] KIND - CommentKind.Metadata
 * [1] MARKER_START - Source offset of ! or # marker
 * [2] HEADER_START - Start of header name
 * [3] HEADER_END - End of header name
 * [4] VALUE_START - Start of value (after colon)
 * [5] VALUE_END - End of value
 *
 * @see {@link https://help.eyeo.com/adblockplus/how-to-write-filters#special-comments}
 */

import { TokenType } from '../../tokenizer/token-types';
import type { PreparserContext } from '../context';
import { lastNonWs, skipWs, tokenStart } from '../context';
import { CM_KIND, CommentKind } from './types';

/**
 * Buffer offset: marker position (! or #).
 */
export const CM_META_MARKER_OFFSET = 1;

/**
 * Buffer offset: start of header name.
 */
export const CM_META_HEADER_START_OFFSET = 2;

/**
 * Buffer offset: end of header name.
 */
export const CM_META_HEADER_END_OFFSET = 3;

/**
 * Buffer offset: start of value (after colon).
 */
export const CM_META_VALUE_START_OFFSET = 4;

/**
 * Buffer offset: end of value.
 */
export const CM_META_VALUE_END_OFFSET = 5;

/**
 * Known metadata header names (lowercase for comparison).
 *
 * Source: `src/parser/comment/metadata-comment-parser.ts`.
 */
const KNOWN_HEADERS: readonly string[] = [
    'checksum',
    'description',
    'expires',
    'homepage',
    'last modified',
    'lastmodified',
    'licence',
    'license',
    'time updated',
    'timeupdated',
    'version',
    'title',
];

/**
 * Case-insensitive comparison of `source[start..start+len)` with `target`.
 *
 * @param source Source string.
 * @param start Start offset in source.
 * @param target Target string (lowercase).
 * @returns `true` if the region matches `target` case-insensitively.
 */
function regionEqualsCI(source: string, start: number, target: string): boolean {
    if (start + target.length > source.length) {
        return false;
    }

    for (let i = 0; i < target.length; i += 1) {
        if (source[start + i].toLowerCase() !== target[i]) {
            return false;
        }
    }

    return true;
}

/**
 * Tries to match a known metadata header starting at `source[start]`.
 * Returns the matched header string, or `null` if none match.
 *
 * @param source Source string.
 * @param start Offset where the header candidate begins.
 * @returns Matched header string or `null`.
 */
export function matchMetadataHeader(source: string, start: number): string | null {
    for (const header of KNOWN_HEADERS) {
        if (regionEqualsCI(source, start, header)) {
            return header;
        }
    }

    return null;
}

/**
 * Preparser for metadata comment rules (`! Header: value`).
 */
export class MetadataCommentPreparser {
    /**
     * Fills `ctx.data` with metadata structural indices.
     *
     * Assumes the caller has already confirmed the rule is a metadata comment
     * (i.e. `matchMetadataHeader` returned a non-null result).
     *
     * @param ctx Preparser context (tokenizer output must be loaded).
     */
    public static preparse(ctx: PreparserContext): void {
        const { data, source } = ctx;

        // Skip leading whitespace, then consume marker
        let ti = skipWs(ctx, 0);

        const markerStart = tokenStart(ctx, ti);

        // skip `!` or `#`
        ti += 1;

        // Skip whitespace after marker
        ti = skipWs(ctx, ti);

        const headerStart = tokenStart(ctx, ti);

        // Advance past header tokens until we hit a Colon or Whitespace
        while (
            ti < ctx.tokenCount
            && ctx.types[ti] !== TokenType.Colon
            && ctx.types[ti] !== TokenType.Whitespace
        ) {
            ti += 1;
        }

        // Account for multi-word headers like "Last Modified"
        if (ti < ctx.tokenCount && ctx.types[ti] === TokenType.Whitespace) {
            // Peek ahead: if the combined text so far + space + next word matches a
            // known header, consume the space and next word too.
            const spaceIdx = ti;
            // skip whitespace
            ti += 1;

            if (ti < ctx.tokenCount && ctx.types[ti] !== TokenType.Colon) {
                const candidateEnd = ctx.ends[ti]; // end of the next word token
                const candidateLen = candidateEnd - headerStart;
                let isMultiWord = false;

                for (const header of KNOWN_HEADERS) {
                    if (
                        candidateLen === header.length
                        && regionEqualsCI(source, headerStart, header)
                    ) {
                        isMultiWord = true;
                        break;
                    }
                }

                if (isMultiWord) {
                    // consume the second word token
                    ti += 1;
                } else {
                    // backtrack: header ends before the space
                    ti = spaceIdx;
                }
            } else {
                // backtrack
                ti = spaceIdx;
            }
        }

        const headerEnd = ti > 0 ? ctx.ends[ti - 1] : headerStart;

        // Expect a Colon separator
        ti = skipWs(ctx, ti);

        if (ti < ctx.tokenCount && ctx.types[ti] === TokenType.Colon) {
            // skip `:`
            ti += 1;
        }

        // Skip whitespace before value
        ti = skipWs(ctx, ti);

        const valueTi = ti;
        const valueStart = tokenStart(ctx, ti);

        // Value end: last non-whitespace token's end position
        const lastTi = lastNonWs(ctx, valueTi, ctx.tokenCount);
        const valueEnd = lastTi >= 0 ? ctx.ends[lastTi] : valueStart;

        data[CM_KIND] = CommentKind.Metadata;
        data[CM_META_MARKER_OFFSET] = markerStart;
        data[CM_META_HEADER_START_OFFSET] = headerStart;
        data[CM_META_HEADER_END_OFFSET] = headerEnd;
        data[CM_META_VALUE_START_OFFSET] = valueStart;
        data[CM_META_VALUE_END_OFFSET] = valueEnd;
    }

    /**
     * Returns the source offset of the comment marker (`!` or `#`).
     *
     * @param data Buffer written by `preparse`.
     * @returns Source offset of the marker character.
     */
    public static markerStart(data: Int32Array): number {
        return data[CM_META_MARKER_OFFSET];
    }

    /**
     * Returns the source start of the metadata header name.
     *
     * @param data Buffer written by `preparse`.
     * @returns Source start offset of the header name.
     */
    public static headerStart(data: Int32Array): number {
        return data[CM_META_HEADER_START_OFFSET];
    }

    /**
     * Returns the exclusive source end of the metadata header name.
     *
     * @param data Buffer written by `preparse`.
     * @returns Source end offset of the header name.
     */
    public static headerEnd(data: Int32Array): number {
        return data[CM_META_HEADER_END_OFFSET];
    }

    /**
     * Returns the source start of the metadata value.
     *
     * @param data Buffer written by `preparse`.
     * @returns Source start offset of the value.
     */
    public static valueStart(data: Int32Array): number {
        return data[CM_META_VALUE_START_OFFSET];
    }

    /**
     * Returns the exclusive source end of the metadata value.
     *
     * @param data Buffer written by `preparse`.
     * @returns Source end offset of the value.
     */
    public static valueEnd(data: Int32Array): number {
        return data[CM_META_VALUE_END_OFFSET];
    }
}
