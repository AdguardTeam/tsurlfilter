/* eslint-disable no-param-reassign */

/**
 * @file Low-level character scanning utilities for preparser stages.
 *
 * These functions operate directly on source strings using character codes
 * for zero-allocation scanning. Used when token-level granularity is
 * insufficient (e.g., parsing scriptlet body contents).
 */

import {
    CHAR_BACKSLASH,
    CHAR_BACKTICK,
    CHAR_DOUBLE_QUOTE,
    CHAR_SINGLE_QUOTE,
    CHAR_SLASH,
    CHAR_SPACE,
    CHAR_TAB,
} from '../utils/char-codes';

/**
 * Skip whitespace (space/tab) forward.
 *
 * @param s Source string.
 * @param i Start offset.
 * @param end Boundary (exclusive).
 *
 * @returns Offset of first non-WS character, or `end`.
 */
export function skipWs(s: string, i: number, end: number): number {
    while (i < end) {
        const c = s.charCodeAt(i);
        if (c !== CHAR_SPACE && c !== CHAR_TAB) {
            break;
        }
        i += 1;
    }
    return i;
}

/**
 * Skip whitespace backward.
 *
 * @param s Source string.
 * @param i Start offset (scanning leftward).
 * @param start Boundary (inclusive).
 *
 * @returns Offset of last non-WS character, or `start - 1`.
 */
export function skipWsBack(s: string, i: number, start: number): number {
    while (i >= start) {
        const c = s.charCodeAt(i);
        if (c !== CHAR_SPACE && c !== CHAR_TAB) {
            break;
        }
        i -= 1;
    }
    return i;
}

/**
 * Find next unescaped occurrence of `ch`.
 *
 * @param s Source string.
 * @param ch Char code to find.
 * @param i Start offset.
 * @param end Boundary (exclusive).
 *
 * @returns Offset of the found character, or -1.
 */
export function findUnescaped(s: string, ch: number, i: number, end: number): number {
    while (i < end) {
        if (s.charCodeAt(i) === CHAR_BACKSLASH) {
            i += 2;
            continue;
        }
        if (s.charCodeAt(i) === ch) {
            return i;
        }
        i += 1;
    }
    return -1;
}

/**
 * Find next unescaped occurrence of `ch` searching backwards.
 *
 * @param s Source string.
 * @param ch Char code to find.
 * @param i Start offset (scanning leftward).
 * @param start Boundary (inclusive).
 *
 * @returns Offset of the found character, or -1.
 */
export function findUnescapedBack(s: string, ch: number, i: number, start: number): number {
    while (i >= start) {
        if (s.charCodeAt(i) === ch) {
            if (i === start || s.charCodeAt(i - 1) !== CHAR_BACKSLASH) {
                return i;
            }
        }
        i -= 1;
    }
    return -1;
}

/**
 * Check if char code is a quote character (', ", `).
 *
 * @param c Char code.
 *
 * @returns True if quote.
 */
export function isQuote(c: number): boolean {
    return c === CHAR_SINGLE_QUOTE || c === CHAR_DOUBLE_QUOTE || c === CHAR_BACKTICK;
}

/**
 * Find next unescaped occurrence of `ch` that is not inside a string
 * literal (single/double/backtick-quoted) or regex literal.
 *
 * @param s Source string.
 * @param ch Char code to find.
 * @param i Start offset.
 * @param end Boundary (exclusive).
 *
 * @returns Offset of the found character, or -1.
 */
export function findUnescapedOutsideStrings(s: string, ch: number, i: number, end: number): number {
    while (i < end) {
        const c = s.charCodeAt(i);

        if (c === CHAR_BACKSLASH) {
            i += 2;
            continue;
        }

        if (c === ch) {
            return i;
        }

        if (c === CHAR_SINGLE_QUOTE || c === CHAR_DOUBLE_QUOTE || c === CHAR_BACKTICK) {
            i += 1;
            while (i < end) {
                const ic = s.charCodeAt(i);
                if (ic === CHAR_BACKSLASH) {
                    i += 2;
                    continue;
                }
                if (ic === c) {
                    break;
                }
                i += 1;
            }
            i += 1;
            continue;
        }

        if (c === CHAR_SLASH) {
            i += 1;
            while (i < end) {
                const ic = s.charCodeAt(i);
                if (ic === CHAR_BACKSLASH) {
                    i += 2;
                    continue;
                }
                if (ic === CHAR_SLASH) {
                    break;
                }
                i += 1;
            }
            i += 1;
            continue;
        }

        i += 1;
    }
    return -1;
}
