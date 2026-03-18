/* eslint-disable no-bitwise */
/* eslint-disable no-param-reassign */
import {
    CHAR_AND_SIGN,
    CHAR_APOSTROPHE,
    CHAR_ASTERISK,
    CHAR_AT_SIGN,
    CHAR_BACKSLASH,
    CHAR_CARET,
    CHAR_CLOSE_BRACE,
    CHAR_CLOSE_PAREN,
    CHAR_CLOSE_SQUARE,
    CHAR_COLON,
    CHAR_COMMA,
    CHAR_DOLLAR_SIGN,
    CHAR_DOT,
    CHAR_EQUALS_SIGN,
    CHAR_EXCLAMATION_MARK,
    CHAR_HASHMARK,
    CHAR_OPEN_BRACE,
    CHAR_OPEN_PAREN,
    CHAR_OPEN_SQUARE,
    CHAR_PERCENT,
    CHAR_PIPE,
    CHAR_PLUS_SIGN,
    CHAR_QUESTION_MARK,
    CHAR_QUOTE,
    CHAR_SEMICOLON,
    CHAR_SLASH,
    CHAR_SPACE,
    CHAR_TAB,
    CHAR_TILDE,
} from './char-codes';
import { TokenType } from './token-types';

/**
 * Optional reserved space at the end of the buffer to trigger overflow earlier.
 * This prevents using the very last slots of the buffer, making overflow handling
 * more predictable and allowing the parser to switch to a slow path earlier.
 */
const RESERVE = 64;

/**
 * Result structure for tokenization.
 * **IMPORTANT**: The `types` and `ends` buffers are reused and overwritten
 * on each tokenization call to minimize memory allocations.
 */
export type TokenizeResult = {
    /**
     * Number of tokens successfully parsed.
     */
    tokenCount: number;
    /**
     * Reusable buffer storing token types (mutated in-place).
     */
    types: Uint8Array;
    /**
     * Reusable buffer storing token end positions (mutated in-place).
     */
    ends: Uint32Array;
    /**
     * The actual character position where tokenization stopped.
     */
    actualEnd: number;
    /**
     * Flag indicating if buffer capacity was exceeded (1) or not (0).
     */
    overflowed: 0 | 1;
};

/**
 * Tokenizes a single line from the source string starting at the given position.
 *
 * **CRITICAL MEMORY BEHAVIOR**: This function **mutates the `out` parameter in-place**
 * by overwriting the existing `types` and `ends` buffers. This design choice trades
 * memory safety for performance:
 *
 * **Benefits**:
 * - Avoids allocating new TypedArrays on every tokenization call
 * - Reduces garbage collection pressure during high-volume parsing
 * - Enables buffer reuse across thousands of filter rules.
 *
 * **WARNING - Users must understand**:
 * 1. **Never** hold references to `out.types` or `out.ends` across multiple calls
 * 2. The buffers are overwritten on each call - previous data is lost
 * 3. If you need to preserve tokens, copy them immediately after tokenization
 * 4. The same `TokenizeResult` object should be reused for sequential tokenizations.
 *
 * **Performance Design**:
 * - Optimized for the common case: 99.9% of filter rules fit within buffer capacity
 * - Overflow handling is minimal (single flag check) to keep fast path fast
 * - Edge cases (0.1% overflow) handled gracefully via `overflowed` flag
 * - Caller can retry with larger buffer or use slow path when overflow occurs.
 *
 * **V8 Optimizations**:
 * - TypedArrays (Uint8Array/Uint32Array) for predictable memory layout and access patterns
 * - Lookup tables instead of conditionals for token mapping and character classification
 * - Monomorphic operations (consistent types) to enable inline caching
 * - Local variable caching (t, e, ws, ident, map) to minimize property access
 * - No dynamic allocations in hot loop - all buffers pre-allocated
 * - Bitwise operations disabled via eslint as they can deopt in some contexts.
 *
 * @param source The source string to tokenize.
 * @param start Starting character position in the source.
 * @param out Pre-allocated result structure (buffers will be overwritten).
 *
 * @example
 * ```ts
 * const result: TokenizeResult = {
 *   tokenCount: 0,
 *   types: new Uint8Array(1024),
 *   ends: new Uint32Array(1024),
 *   actualEnd: 0,
 *   overflowed: 0,
 * };
 *
 * // First call - writes to buffers
 * tokenizeLine("example.com", 0, result);
 * // result.types and result.ends now contain tokens for "example.com"
 *
 * // Second call - OVERWRITES the same buffers
 * tokenizeLine("test.org", 0, result);
 * // Previous "example.com" tokens are now lost!
 * ```
 */
export const tokenizeLine = (() => {
    // Lookup table for single-character tokens
    const TOKEN_MAP = new Uint8Array(256);
    TOKEN_MAP[CHAR_SLASH] = TokenType.Slash;
    TOKEN_MAP[CHAR_EQUALS_SIGN] = TokenType.EqualsSign;
    TOKEN_MAP[CHAR_COMMA] = TokenType.Comma;
    TOKEN_MAP[CHAR_OPEN_PAREN] = TokenType.OpenParen;
    TOKEN_MAP[CHAR_CLOSE_PAREN] = TokenType.CloseParen;
    TOKEN_MAP[CHAR_OPEN_BRACE] = TokenType.OpenBrace;
    TOKEN_MAP[CHAR_CLOSE_BRACE] = TokenType.CloseBrace;
    TOKEN_MAP[CHAR_OPEN_SQUARE] = TokenType.OpenSquare;
    TOKEN_MAP[CHAR_CLOSE_SQUARE] = TokenType.CloseSquare;
    TOKEN_MAP[CHAR_PIPE] = TokenType.Pipe;
    TOKEN_MAP[CHAR_AT_SIGN] = TokenType.AtSign;
    TOKEN_MAP[CHAR_ASTERISK] = TokenType.Asterisk;
    TOKEN_MAP[CHAR_QUOTE] = TokenType.Quote;
    TOKEN_MAP[CHAR_APOSTROPHE] = TokenType.Apostrophe;
    TOKEN_MAP[CHAR_EXCLAMATION_MARK] = TokenType.ExclamationMark;
    TOKEN_MAP[CHAR_PLUS_SIGN] = TokenType.PlusSign;
    TOKEN_MAP[CHAR_AND_SIGN] = TokenType.AndSign;
    TOKEN_MAP[CHAR_TILDE] = TokenType.Tilde;
    TOKEN_MAP[CHAR_CARET] = TokenType.Caret;
    TOKEN_MAP[CHAR_DOT] = TokenType.Dot;
    TOKEN_MAP[CHAR_SEMICOLON] = TokenType.Semicolon;
    TOKEN_MAP[CHAR_COLON] = TokenType.Colon;
    TOKEN_MAP[CHAR_HASHMARK] = TokenType.HashMark;
    TOKEN_MAP[CHAR_DOLLAR_SIGN] = TokenType.DollarSign;
    TOKEN_MAP[CHAR_QUESTION_MARK] = TokenType.QuestionMark;
    TOKEN_MAP[CHAR_PERCENT] = TokenType.Percent;

    // Whitespace lookup
    const IS_WHITESPACE = new Uint8Array(256);
    IS_WHITESPACE[CHAR_SPACE] = 1;
    IS_WHITESPACE[CHAR_TAB] = 1;

    // Identifier lookup
    const IS_IDENT_CHAR = new Uint8Array(256);
    for (let i = 48; i <= 57; i += 1) {
        IS_IDENT_CHAR[i] = 1;
    }
    for (let i = 65; i <= 90; i += 1) {
        IS_IDENT_CHAR[i] = 1;
    }
    for (let i = 97; i <= 122; i += 1) {
        IS_IDENT_CHAR[i] = 1;
    }
    IS_IDENT_CHAR[45] = 1; // -
    IS_IDENT_CHAR[95] = 1; // _

    const LF = 10;
    const CR = 13;

    return (source: string, start: number, out: TokenizeResult): void => {
        const s = source;
        const len = s.length;

        const t = out.types;
        const e = out.ends;
        const cap = t.length;

        const ws = IS_WHITESPACE;
        const ident = IS_IDENT_CHAR;
        const map = TOKEN_MAP;

        let i = start;
        let tokenCount = 0;

        // Reset overflow flag
        out.overflowed = 0;

        // Reserve space at the end of the buffer to trigger overflow earlier.
        // This prevents fully filling the buffer and allows the parser to
        // switch to a slower, more robust path when approaching capacity limits.
        //
        // If you want to use the full buffer capacity without reserve,
        // set: remaining = cap;
        let remaining = cap - RESERVE;
        if (remaining < 0) {
            remaining = 0;
        }

        while (i < len) {
            const c = s.charCodeAt(i);

            if (c === LF || c === CR) {
                break;
            }

            // No more space for new tokens: stop after the last stored token.
            if (remaining === 0) {
                out.overflowed = 1;
                break;
            }

            if (c < 256) {
                const mapped = map[c];
                if (mapped) {
                    t[tokenCount] = mapped;
                    e[tokenCount] = i + 1;
                    tokenCount += 1;
                    remaining -= 1;
                    i += 1;
                    continue;
                }

                if (ws[c]) {
                    i += 1;
                    while (i < len) {
                        const cc = s.charCodeAt(i);
                        if (cc >= 256 || !ws[cc]) {
                            break;
                        }
                        i += 1;
                    }
                    t[tokenCount] = TokenType.Whitespace;
                    e[tokenCount] = i;
                    tokenCount += 1;
                    remaining -= 1;
                    continue;
                }

                if (c === CHAR_BACKSLASH) {
                    if (i + 1 < len) {
                        t[tokenCount] = TokenType.Escaped;
                        e[tokenCount] = i + 2;
                        tokenCount += 1;
                        remaining -= 1;
                        i += 2;
                    } else {
                        t[tokenCount] = TokenType.Symbol;
                        e[tokenCount] = i + 1;
                        tokenCount += 1;
                        remaining -= 1;
                        i += 1;
                    }
                    continue;
                }

                if (ident[c]) {
                    i += 1;
                    while (i < len) {
                        const cc = s.charCodeAt(i);
                        if (cc >= 256 || !ident[cc]) {
                            break;
                        }
                        i += 1;
                    }
                    t[tokenCount] = TokenType.Ident;
                    e[tokenCount] = i;
                    tokenCount += 1;
                    remaining -= 1;
                    continue;
                }

                // Symbol fallback
                t[tokenCount] = TokenType.Symbol;
                e[tokenCount] = i + 1;
                tokenCount += 1;
                remaining -= 1;
                i += 1;
                continue;
            }

            // Non-ASCII fallback (could implement UnicodeSequence run instead)
            t[tokenCount] = TokenType.Symbol;
            e[tokenCount] = i + 1;
            tokenCount += 1;
            remaining -= 1;
            i += 1;
        }

        out.tokenCount = tokenCount;
        out.actualEnd = i;
    };
})();
