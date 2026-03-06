/* eslint-disable no-param-reassign */

/**
 * @file Value preparser — standard and replace modifier value parsing.
 *
 * Lowest level in the preparser chain. Advances through tokens to
 * determine value boundaries without allocating strings.
 */

import { TokenType } from '../../tokenizer/token-types';
import type { PreparserContext } from '../context';
import { skipUntil } from '../context';
import { isPotentialNetModifier } from './shared';

const CHAR_R = 114;
const CHAR_E = 101;
const CHAR_P = 112;
const CHAR_L = 108;
const CHAR_A = 97;
const CHAR_C = 99;

/**
 * Preparsers for modifier values.
 *
 * Provides static methods for standard and replace modifier value parsing.
 */
export class ValuePreparser {
    /**
     * Standard modifier value parsing.
     * Advances to next comma, consuming commas that are NOT modifier separators.
     *
     * @param ctx Preparser context.
     * @param ti Token index at start of value.
     * @param end Token count boundary.
     * @returns Token index at the separator comma or `end`.
     */
    static parseStandard(ctx: PreparserContext, ti: number, end: number): number {
        ti = skipUntil(ctx, ti, end, TokenType.Comma);

        while (ti < end && ctx.types[ti] === TokenType.Comma && !isPotentialNetModifier(ctx, ti + 1)) {
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
     * @param ctx Preparser context.
     * @param ti Token index at start of value (the opening `/` or `'`).
     * @param end Token count boundary.
     * @returns Token index at the separator comma or `end`.
     */
    static parseReplace(ctx: PreparserContext, ti: number, end: number): number {
        const { types } = ctx;

        if (types[ti] === TokenType.Slash) {
            // consume opening /
            ti += 1;
            ti = ValuePreparser.skipUntilSlashRespectingBrackets(ctx, ti, end);
            if (ti < end) {
                // consume closing / (end of regex part)
                ti += 1;
            }
            ti = ValuePreparser.skipUntilSlashRespectingBrackets(ctx, ti, end);
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
     * @returns `true` if the region equals "replace".
     */
    static isReplaceName(source: string, start: number, end: number): boolean {
        return (end - start) === 7
            && source.charCodeAt(start) === CHAR_R
            && source.charCodeAt(start + 1) === CHAR_E
            && source.charCodeAt(start + 2) === CHAR_P
            && source.charCodeAt(start + 3) === CHAR_L
            && source.charCodeAt(start + 4) === CHAR_A
            && source.charCodeAt(start + 5) === CHAR_C
            && source.charCodeAt(start + 6) === CHAR_E;
    }

    /**
     * Skip until the next unescaped slash, respecting character classes ([...]).
     *
     * @param ctx Preparser context.
     * @param ti Token index to start scanning from.
     * @param end Token count boundary.
     * @returns Token index at the closing slash, or `end`.
     */
    private static skipUntilSlashRespectingBrackets(
        ctx: PreparserContext,
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
