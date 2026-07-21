/* eslint-disable no-param-reassign */

/**
 * @file Value parser — standard and replace modifier value parsing.
 *
 * Lowest level in the parser chain. Advances through tokens to
 * determine value boundaries without allocating strings.
 */

import { TokenType } from '../../tokenizer/token-types';
import type { ParserContext } from '../context';
import { regionEquals, skipUntil } from '../context';
import type { CursorParser } from '../types';

import { isPotentialNetModifier } from './shared';

/**
 * Parsers for modifier values.
 *
 * Provides static methods for standard and replace modifier value parsing.
 */
export class ValueParser implements CursorParser {
    /**
     * Standard modifier value parsing.
     * Advances to next comma, consuming commas that are NOT modifier separators.
     *
     * @param ctx Parser context.
     * @param ti Token index at start of value.
     * @param end Token count boundary.
     *
     * @returns Token index at the separator comma or `end`.
     */
    public static parseStandard(ctx: ParserContext, ti: number, end: number): number {
        ti = skipUntil(ctx, ti, end, TokenType.Comma);

        while (ti < end && ctx.types[ti] === TokenType.Comma && !isPotentialNetModifier(ctx, ti + 1, end)) {
            // consume non-separator comma
            ti += 1;
            ti = skipUntil(ctx, ti, end, TokenType.Comma);
        }

        return ti;
    }

    /**
     * Replace modifier value parsing.
     * Handles `/regex/replacement/flags` and `'text'` formats.
     *
     * @param ctx Parser context.
     * @param ti Token index at start of value (the opening `/` or `'`).
     * @param end Token count boundary.
     *
     * @returns Token index at the separator comma or `end`.
     */
    public static parseReplace(ctx: ParserContext, ti: number, end: number): number {
        const { types } = ctx;

        if (types[ti] === TokenType.Slash) {
            // consume opening /
            ti += 1;
            ti = ValueParser.skipUntilSlashRespectingBrackets(ctx, ti, end);
            if (ti < end) {
                // consume closing / (end of regex part)
                ti += 1;
            }
            ti = ValueParser.skipUntilSlashRespectingBrackets(ctx, ti, end);
            if (ti < end) {
                // consume closing / (end of replacement part)
                ti += 1;
            }
            ti = skipUntil(ctx, ti, end, TokenType.Comma); // flags and remainder
        } else if (types[ti] === TokenType.Apostrophe) {
            // consume opening '
            ti += 1;
            ti = skipUntil(ctx, ti, end, TokenType.Apostrophe);
            if (ti < end) {
                // consume closing '
                ti += 1;
            }
            ti = skipUntil(ctx, ti, end, TokenType.Comma);
        }
        // else: unexpected format, fall through (robustness)

        return ti;
    }

    /**
     * Checks if a source region equals "replace" without allocating a string.
     *
     * @param source Source string.
     * @param start Start index (inclusive).
     * @param end End index (exclusive).
     *
     * @returns `true` if the region equals "replace".
     */
    public static isReplaceName(source: string, start: number, end: number): boolean {
        return regionEquals(source, start, end, 'replace');
    }

    /**
     * Skip until the next unescaped slash, respecting character classes ([...]).
     *
     * @param ctx Parser context.
     * @param ti Token index to start scanning from.
     * @param end Token count boundary.
     *
     * @returns Token index at the closing slash, or `end`.
     */
    private static skipUntilSlashRespectingBrackets(
        ctx: ParserContext,
        ti: number,
        end: number,
    ): number {
        const { types } = ctx;
        let bracketDepth = 0;

        while (ti < end) {
            const current = types[ti];

            if (current === TokenType.Escaped) {
                ti += 1;
                continue;
            }

            if (current === TokenType.OpenSquare) {
                bracketDepth += 1;
            } else if (current === TokenType.CloseSquare && bracketDepth > 0) {
                bracketDepth -= 1;
            } else if (current === TokenType.Slash && bracketDepth === 0) {
                return ti;
            }

            ti += 1;
        }

        return ti;
    }
}
