/**
 * @file CSS token mapping utilities.
 *
 * Span-length functions that classify runs of adblock tokenizer output
 * (`Uint8Array` types + `Uint32Array` ends) as CSS Syntax Level 3 tokens.
 * Every function returns the number of adblock tokens consumed (0 = no match).
 *
 * Design constraints:
 * - Zero heap allocation in all function bodies (only module-level tables).
 * - Source-text fallback only where required (escapes, exponents, CDO/CDC).
 * - Tight inner loops with Uint8Array lookups for hot paths.
 *
 * References:
 * - CSS Syntax Level 3 §4: https://www.w3.org/TR/css-syntax-3/#tokenization.
 */

import {
    CHAR_CARRIAGE_RETURN,
    CHAR_FORM_FEED,
    CHAR_GREATER_THAN,
    CHAR_LESS_THAN,
    CHAR_LINE_FEED,
    CHAR_LOWER_A,
    CHAR_LOWER_E,
    CHAR_LOWER_F,
    CHAR_NINE,
    CHAR_UPPER_A,
    CHAR_UPPER_E,
    CHAR_UPPER_F,
    CHAR_ZERO,
} from '../../tokenizer/char-codes';
import { TokenType } from '../../tokenizer/token-types';

import { isCssIdentPart, isCssIdentStart, isCssWhitespace } from './css-token-utils';

/**
 * 256-entry lookup table: `IS_HEX_DIGIT[charCode]` is 1 if the char is a hex
 * digit (`0-9`, `A-F`, `a-f`), 0 otherwise.
 */
let IS_HEX_DIGIT: Uint8Array | undefined;

/**
 * 256-entry lookup table: `IS_NEWLINE[charCode]` is 1 if the char is a CSS
 * newline (`\n`, `\r`, `\f`), 0 otherwise.
 */
let IS_NEWLINE: Uint8Array | undefined;

/**
 * 256-entry lookup table: `IS_TRIVIAL_TOKEN[tokenType]` is 1 if the token
 * type maps 1:1 to a CSS token (colon, semicolon, comma, parens, brackets,
 * braces), 0 otherwise.
 */
let IS_TRIVIAL_TOKEN: Uint8Array | undefined;

/**
 * Ensure all module-level lookup tables are initialised. Called once on first
 * use; subsequent calls are no-ops.
 */
function ensureTables(): void {
    if (IS_HEX_DIGIT) {
        return;
    }

    IS_HEX_DIGIT = new Uint8Array(256);
    for (let i = CHAR_ZERO; i <= CHAR_NINE; i += 1) {
        IS_HEX_DIGIT[i] = 1;
    }
    for (let i = CHAR_UPPER_A; i <= CHAR_UPPER_F; i += 1) {
        IS_HEX_DIGIT[i] = 1;
    }
    for (let i = CHAR_LOWER_A; i <= CHAR_LOWER_F; i += 1) {
        IS_HEX_DIGIT[i] = 1;
    }

    IS_NEWLINE = new Uint8Array(256);
    IS_NEWLINE[CHAR_LINE_FEED] = 1;
    IS_NEWLINE[CHAR_CARRIAGE_RETURN] = 1;
    IS_NEWLINE[CHAR_FORM_FEED] = 1;

    IS_TRIVIAL_TOKEN = new Uint8Array(256);
    IS_TRIVIAL_TOKEN[TokenType.Colon] = 1;
    IS_TRIVIAL_TOKEN[TokenType.Semicolon] = 1;
    IS_TRIVIAL_TOKEN[TokenType.Comma] = 1;
    IS_TRIVIAL_TOKEN[TokenType.OpenParen] = 1;
    IS_TRIVIAL_TOKEN[TokenType.CloseParen] = 1;
    IS_TRIVIAL_TOKEN[TokenType.OpenSquare] = 1;
    IS_TRIVIAL_TOKEN[TokenType.CloseSquare] = 1;
    IS_TRIVIAL_TOKEN[TokenType.OpenBrace] = 1;
    IS_TRIVIAL_TOKEN[TokenType.CloseBrace] = 1;
}

/**
 * Get the start offset of token `i` in the source string.
 *
 * @param ends Token end-offset buffer.
 * @param i Token index.
 * @param initialOffset Start offset of the first token (typically 0).
 *
 * @returns Source offset of the first character of token `i`.
 */
function tokenStart(ends: Uint32Array, i: number, initialOffset: number): number {
    return i > 0 ? ends[i - 1] : initialOffset;
}

/**
 * Consume a single CSS escape sequence starting at token `offset`.
 *
 * Implements CSS §4.3.7 "consume an escaped code point" adapted to the adblock
 * token stream model. The adblock tokenizer emits `Escaped` as exactly 2
 * source characters (backslash + one char). A CSS hex escape can span
 * additional tokens: `\` + 1–6 hex digits + optional whitespace.
 *
 * @param types Token type buffer.
 * @param offset Token index where `Escaped` is expected.
 * @param tokenCount Total valid tokens.
 * @param source Source string.
 * @param ends Token end-offset buffer.
 * @param initialOffset Start offset of token 0 in source.
 *
 * @returns Number of adblock tokens consumed (0 = invalid escape or no
 * Escaped token at `offset`).
 */
function consumeCssEscape(
    types: Uint8Array,
    offset: number,
    tokenCount: number,
    source: string,
    ends: Uint32Array,
    initialOffset: number,
): number {
    ensureTables();

    if (offset >= tokenCount || types[offset] !== TokenType.Escaped) {
        return 0;
    }

    // The Escaped token covers 2 source chars: backslash + 1 char.
    // Check the character after the backslash.
    const escapedCharCode = source.charCodeAt(ends[offset] - 1);

    // If the escaped char is a newline, the escape is invalid per CSS spec.
    if (IS_NEWLINE![escapedCharCode]) {
        return 0;
    }

    // If the escaped char is NOT a hex digit, it's a simple non-hex escape.
    if (!IS_HEX_DIGIT![escapedCharCode]) {
        return 1;
    }

    // Hex escape: the first hex digit is inside the Escaped token.
    // Now consume up to 5 more hex digits from subsequent tokens.
    // Each hex digit occupies source chars that may be in Digit or Letter tokens.
    let consumed = 1; // The Escaped token itself
    let hexCount = 1; // Already have 1 hex digit from the Escaped token

    let i = offset + 1;
    while (i < tokenCount && hexCount < 6) {
        const tt = types[i];
        // Only Digit and Letter tokens can contain hex digits
        if (tt !== TokenType.Digit && tt !== TokenType.Letter) {
            break;
        }
        // Check each source character in this token
        const start = tokenStart(ends, i, initialOffset);
        const end = ends[i];
        let pos = start;
        while (pos < end && hexCount < 6) {
            if (!IS_HEX_DIGIT![source.charCodeAt(pos)]) {
                break;
            }
            hexCount += 1;
            pos += 1;
        }
        // Only consume the token if every character in it was scanned as a hex
        // digit (pos reached end). If we stopped early — either because a
        // non-hex character appeared or because the 6-digit limit was hit before
        // the token ended — we cannot partially consume the token.
        if (pos < end) {
            break;
        }
        consumed += 1;
        i += 1;
    }

    // Optionally consume one trailing whitespace token
    const nextIdx = offset + consumed;
    if (nextIdx < tokenCount && isCssWhitespace(types[nextIdx])) {
        consumed += 1;
    }

    return consumed;
}

/**
 * Whether the token pair at `offset` forms a valid CSS escape.
 *
 * Per CSS §4.3.8: a valid escape is a backslash followed by a non-newline
 * character.
 *
 * @param types Token type buffer.
 * @param offset Token index to check.
 * @param source Source string.
 * @param ends Token end-offset buffer.
 *
 * @returns `true` if `types[offset]` is an `Escaped` token and the escaped
 * character is not a newline.
 */
export function isCssValidEscape(
    types: Uint8Array,
    offset: number,
    source: string,
    ends: Uint32Array,
): boolean {
    ensureTables();

    if (types[offset] !== TokenType.Escaped) {
        return false;
    }
    const escapedCharCode = source.charCodeAt(ends[offset] - 1);
    return !IS_NEWLINE![escapedCharCode];
}

/**
 * Number of adblock tokens that form a CSS `<ident-token>` starting at
 * `offset`.
 *
 * Implements CSS §4.3.9 "check if three code points would start an ident
 * sequence" (https://www.w3.org/TR/css-syntax-3/#would-start-an-identifier)
 * + §4.3.11 "consume an ident sequence"
 * (https://www.w3.org/TR/css-syntax-3/#consume-name).
 *
 * @param types Token type buffer.
 * @param offset Start index.
 * @param tokenCount Total valid tokens.
 * @param source Source string.
 * @param ends Token end-offset buffer.
 * @param initialOffset Start offset of token 0 in source.
 *
 * @returns Span length (0 if no ident sequence starts at `offset`).
 */
export function cssIdentSequenceLength(
    types: Uint8Array,
    offset: number,
    tokenCount: number,
    source: string,
    ends: Uint32Array,
    initialOffset: number,
): number {
    if (offset >= tokenCount) {
        return 0;
    }

    let i = offset;
    const t0 = types[i];

    // §4.3.9: https://www.w3.org/TR/css-syntax-3/#would-start-an-identifier
    if (t0 === TokenType.Hyphen) {
        // Starts with hyphen: next must be ident-start, hyphen, or valid escape
        i += 1;
        if (i >= tokenCount) {
            return 0;
        }
        const t1 = types[i];
        if (isCssIdentStart(t1) || t1 === TokenType.Hyphen) {
            i += 1;
        } else if (t1 === TokenType.Escaped) {
            const esc = consumeCssEscape(types, i, tokenCount, source, ends, initialOffset);
            if (esc === 0) {
                return 0;
            }
            i += esc;
        } else {
            return 0;
        }
    } else if (isCssIdentStart(t0)) {
        // Starts with ident-start code point
        i += 1;
    } else if (t0 === TokenType.Escaped) {
        // Starts with valid escape
        const esc = consumeCssEscape(types, i, tokenCount, source, ends, initialOffset);
        if (esc === 0) {
            return 0;
        }
        i += esc;
    } else {
        return 0;
    }

    // §4.3.11: https://www.w3.org/TR/css-syntax-3/#consume-name
    while (i < tokenCount) {
        const tt = types[i];
        if (isCssIdentPart(tt)) {
            i += 1;
        } else if (tt === TokenType.Escaped) {
            const esc = consumeCssEscape(types, i, tokenCount, source, ends, initialOffset);
            if (esc === 0) {
                break;
            }
            i += esc;
        } else {
            break;
        }
    }

    return i - offset;
}

/**
 * Number of adblock tokens that form a CSS `<whitespace-token>` starting at
 * `offset`.
 *
 * Consumes consecutive `Whitespace` and `LineBreak` tokens.
 *
 * @param types Token type buffer.
 * @param offset Start index.
 * @param tokenCount Total valid tokens.
 *
 * @returns Span length (0 if no whitespace at `offset`).
 */
export function cssWhitespaceLength(
    types: Uint8Array,
    offset: number,
    tokenCount: number,
): number {
    let i = offset;
    while (i < tokenCount && isCssWhitespace(types[i])) {
        i += 1;
    }
    return i - offset;
}

/**
 * Number of adblock tokens that form a CSS comment starting at `offset`.
 *
 * Matches `Slash` + `Asterisk`, then scans for `Asterisk` + `Slash`
 * terminator. Unterminated comments consume all remaining tokens.
 *
 * @param types Token type buffer.
 * @param offset Start index.
 * @param tokenCount Total valid tokens.
 *
 * @returns Span length (0 if no comment starts at `offset`).
 */
export function cssCommentLength(
    types: Uint8Array,
    offset: number,
    tokenCount: number,
): number {
    // Need at least Slash + Asterisk
    if (offset + 1 >= tokenCount) {
        return 0;
    }
    if (types[offset] !== TokenType.Slash || types[offset + 1] !== TokenType.Asterisk) {
        return 0;
    }

    // Scan for closing */ or end of tokens
    let i = offset + 2;
    while (i < tokenCount) {
        if (types[i] === TokenType.Asterisk && i + 1 < tokenCount && types[i + 1] === TokenType.Slash) {
            return (i + 2) - offset;
        }
        i += 1;
    }

    // Unterminated comment — consume everything
    return tokenCount - offset;
}

/**
 * Number of adblock tokens that form a CSS `<string-token>` starting at
 * `offset`.
 *
 * Matches an opening `Quote` or `Apostrophe`, then scans for the matching
 * close quote. Handles:
 * - `Escaped` tokens inside (valid string content)
 * - `LineBreak` inside → bad-string-token (returns span up to and including
 *   the newline)
 * - EOF → unterminated string (returns span to end).
 *
 * @param types Token type buffer.
 * @param offset Start index.
 * @param tokenCount Total valid tokens.
 *
 * @returns Span length (0 if no string starts at `offset`).
 */
export function cssStringLength(
    types: Uint8Array,
    offset: number,
    tokenCount: number,
): number {
    if (offset >= tokenCount) {
        return 0;
    }

    const opening = types[offset];
    if (opening !== TokenType.Quote && opening !== TokenType.Apostrophe) {
        return 0;
    }

    let i = offset + 1;
    while (i < tokenCount) {
        const tt = types[i];
        if (tt === opening) {
            // Closing quote found
            return (i + 1) - offset;
        }
        if (tt === TokenType.LineBreak) {
            // Bad-string: include the newline
            return (i + 1) - offset;
        }
        // For Escaped tokens (and all other token types), advance by one.
        i += 1;
    }

    // Unterminated string — consume to end
    return tokenCount - offset;
}

/**
 * Number of adblock tokens that form a CSS numeric value starting at `offset`.
 *
 * Parses: `[+|-]? ([0-9]+ '.'? [0-9]* | '.' [0-9]+) ([eE] [+|-]? [0-9]+)?`.
 *
 * The exponent `e`/`E` detection requires source-text inspection since `e` is
 * part of a `Letter` token.
 *
 * @param types Token type buffer.
 * @param offset Start index.
 * @param tokenCount Total valid tokens.
 * @param source Source string.
 * @param ends Token end-offset buffer.
 * @param initialOffset Start offset of token 0 in source.
 *
 * @returns Span length (0 if no number starts at `offset`).
 */
function consumeCssNumber(
    types: Uint8Array,
    offset: number,
    tokenCount: number,
    source: string,
    ends: Uint32Array,
    initialOffset: number,
): number {
    if (offset >= tokenCount) {
        return 0;
    }

    let i = offset;

    // Optional sign
    const t0 = types[i];
    if (t0 === TokenType.PlusSign || t0 === TokenType.Hyphen) {
        i += 1;
        if (i >= tokenCount) {
            return 0;
        }
    }

    // Integer or fractional part
    let hasDigits = false;
    if (i < tokenCount && types[i] === TokenType.Digit) {
        hasDigits = true;
        i += 1;
    }

    // Optional dot + digits
    if (i < tokenCount && types[i] === TokenType.Dot) {
        const dotIdx = i;
        i += 1;
        if (i < tokenCount && types[i] === TokenType.Digit) {
            hasDigits = true;
            i += 1;
        } else if (!hasDigits) {
            // Just a dot with no digits — not a number
            return 0;
        } else {
            // Digits + dot but no digits after dot — backtrack the dot
            i = dotIdx;
        }
    }

    if (!hasDigits) {
        return 0;
    }

    // Optional exponent: [eE] [+|-]? [0-9]+
    if (i < tokenCount && types[i] === TokenType.Letter) {
        const letterStart = tokenStart(ends, i, initialOffset);
        const letterEnd = ends[i];
        // Must be exactly one character: 'e' or 'E'
        if (letterEnd - letterStart === 1) {
            const ch = source.charCodeAt(letterStart);
            if (ch === CHAR_LOWER_E || ch === CHAR_UPPER_E) {
                const expStart = i;
                i += 1;
                // Optional sign
                if (i < tokenCount && (types[i] === TokenType.PlusSign || types[i] === TokenType.Hyphen)) {
                    i += 1;
                }
                // Required: at least one digit
                if (i < tokenCount && types[i] === TokenType.Digit) {
                    i += 1;
                } else {
                    // No digit after exponent — backtrack
                    i = expStart;
                }
            }
        }
    }

    return i - offset;
}

/**
 * Number of adblock tokens that form a CSS `<number-token>` starting at
 * `offset`.
 *
 * @param types Token type buffer.
 * @param offset Start index.
 * @param tokenCount Total valid tokens.
 * @param source Source string.
 * @param ends Token end-offset buffer.
 * @param initialOffset Start offset of token 0 in source.
 *
 * @returns Span length (0 if no number starts at `offset`).
 */
export function cssNumberLength(
    types: Uint8Array,
    offset: number,
    tokenCount: number,
    source: string,
    ends: Uint32Array,
    initialOffset: number,
): number {
    return consumeCssNumber(types, offset, tokenCount, source, ends, initialOffset);
}

/**
 * Number of adblock tokens that form a CSS `<percentage-token>` starting at
 * `offset`: a number followed immediately by `%`.
 *
 * @param types Token type buffer.
 * @param offset Start index.
 * @param tokenCount Total valid tokens.
 * @param source Source string.
 * @param ends Token end-offset buffer.
 * @param initialOffset Start offset of token 0 in source.
 *
 * @returns Span length (0 if no percentage starts at `offset`).
 */
export function cssPercentageLength(
    types: Uint8Array,
    offset: number,
    tokenCount: number,
    source: string,
    ends: Uint32Array,
    initialOffset: number,
): number {
    const numLen = consumeCssNumber(types, offset, tokenCount, source, ends, initialOffset);
    if (numLen === 0) {
        return 0;
    }
    const nextIdx = offset + numLen;
    if (nextIdx < tokenCount && types[nextIdx] === TokenType.Percent) {
        return numLen + 1;
    }
    return 0;
}

/**
 * Number of adblock tokens that form a CSS `<dimension-token>` starting at
 * `offset`: a number followed immediately by an ident sequence (unit).
 *
 * @param types Token type buffer.
 * @param offset Start index.
 * @param tokenCount Total valid tokens.
 * @param source Source string.
 * @param ends Token end-offset buffer.
 * @param initialOffset Start offset of token 0 in source.
 *
 * @returns Span length (0 if no dimension starts at `offset`).
 */
export function cssDimensionLength(
    types: Uint8Array,
    offset: number,
    tokenCount: number,
    source: string,
    ends: Uint32Array,
    initialOffset: number,
): number {
    const numLen = consumeCssNumber(types, offset, tokenCount, source, ends, initialOffset);
    if (numLen === 0) {
        return 0;
    }
    const identLen = cssIdentSequenceLength(
        types,
        offset + numLen,
        tokenCount,
        source,
        ends,
        initialOffset,
    );
    if (identLen === 0) {
        return 0;
    }
    return numLen + identLen;
}

/**
 * Number of adblock tokens that form a CSS `<hash-token>` starting at
 * `offset`: `#` followed by ident-code-point(s) or a valid escape.
 *
 * @param types Token type buffer.
 * @param offset Start index.
 * @param tokenCount Total valid tokens.
 * @param source Source string.
 * @param ends Token end-offset buffer.
 * @param initialOffset Start offset of token 0 in source.
 *
 * @returns Span length (0 if no hash token starts at `offset`).
 */
export function cssHashLength(
    types: Uint8Array,
    offset: number,
    tokenCount: number,
    source: string,
    ends: Uint32Array,
    initialOffset: number,
): number {
    if (offset >= tokenCount || types[offset] !== TokenType.HashMark) {
        return 0;
    }

    const afterHash = offset + 1;
    if (afterHash >= tokenCount) {
        return 0;
    }

    // Next must be ident-code-point or valid escape
    const nextType = types[afterHash];
    if (!isCssIdentPart(nextType) && nextType !== TokenType.Escaped) {
        return 0;
    }
    if (nextType === TokenType.Escaped && !isCssValidEscape(types, afterHash, source, ends)) {
        return 0;
    }

    // Consume ident-like sequence (ident-code-points + valid escapes)
    let i = afterHash;
    while (i < tokenCount) {
        const tt = types[i];
        if (isCssIdentPart(tt)) {
            i += 1;
        } else if (tt === TokenType.Escaped) {
            const esc = consumeCssEscape(types, i, tokenCount, source, ends, initialOffset);
            if (esc === 0) {
                break;
            }
            i += esc;
        } else {
            break;
        }
    }

    return i - offset;
}

/**
 * Number of adblock tokens that form a CSS `<at-keyword-token>` starting at
 * `offset`: `@` followed by an ident sequence.
 *
 * @param types Token type buffer.
 * @param offset Start index.
 * @param tokenCount Total valid tokens.
 * @param source Source string.
 * @param ends Token end-offset buffer.
 * @param initialOffset Start offset of token 0 in source.
 *
 * @returns Span length (0 if no at-keyword starts at `offset`).
 */
export function cssAtKeywordLength(
    types: Uint8Array,
    offset: number,
    tokenCount: number,
    source: string,
    ends: Uint32Array,
    initialOffset: number,
): number {
    if (offset >= tokenCount || types[offset] !== TokenType.AtSign) {
        return 0;
    }

    const identLen = cssIdentSequenceLength(
        types,
        offset + 1,
        tokenCount,
        source,
        ends,
        initialOffset,
    );
    if (identLen === 0) {
        return 0;
    }

    return 1 + identLen;
}

/**
 * Number of adblock tokens that form a CSS `<function-token>` starting at
 * `offset`: an ident sequence followed immediately by `(`.
 *
 * @param types Token type buffer.
 * @param offset Start index.
 * @param tokenCount Total valid tokens.
 * @param source Source string.
 * @param ends Token end-offset buffer.
 * @param initialOffset Start offset of token 0 in source.
 *
 * @returns Span length (0 if no function token starts at `offset`).
 */
export function cssFunctionLength(
    types: Uint8Array,
    offset: number,
    tokenCount: number,
    source: string,
    ends: Uint32Array,
    initialOffset: number,
): number {
    const identLen = cssIdentSequenceLength(types, offset, tokenCount, source, ends, initialOffset);
    if (identLen === 0) {
        return 0;
    }
    const nextIdx = offset + identLen;
    if (nextIdx < tokenCount && types[nextIdx] === TokenType.OpenParen) {
        return identLen + 1;
    }
    return 0;
}

/**
 * Number of adblock tokens that form a CSS `<!--` (CDO) token starting at
 * `offset`.
 *
 * Matches: `Symbol(<)` + `ExclamationMark` + `Hyphen` + `Hyphen`.
 * The `<` must be verified via source text since `Symbol` is a catch-all.
 *
 * @param types Token type buffer.
 * @param offset Start index.
 * @param tokenCount Total valid tokens.
 * @param source Source string.
 * @param ends Token end-offset buffer.
 * @param initialOffset Start offset of token 0 in source.
 *
 * @returns 4 if CDO found, 0 otherwise.
 */
export function cssCdoLength(
    types: Uint8Array,
    offset: number,
    tokenCount: number,
    source: string,
    ends: Uint32Array,
    initialOffset: number,
): number {
    if (offset + 3 >= tokenCount) {
        return 0;
    }
    if (types[offset] !== TokenType.Symbol) {
        return 0;
    }
    // Verify it's '<'
    const start = tokenStart(ends, offset, initialOffset);
    if (source.charCodeAt(start) !== CHAR_LESS_THAN) {
        return 0;
    }
    if (
        types[offset + 1] !== TokenType.ExclamationMark
        || types[offset + 2] !== TokenType.Hyphen
        || types[offset + 3] !== TokenType.Hyphen
    ) {
        return 0;
    }
    return 4;
}

/**
 * Number of adblock tokens that form a CSS `-->` (CDC) token starting at
 * `offset`.
 *
 * Matches: `Hyphen` + `Hyphen` + `Symbol(>)`.
 * The `>` must be verified via source text since `Symbol` is a catch-all.
 *
 * @param types Token type buffer.
 * @param offset Start index.
 * @param tokenCount Total valid tokens.
 * @param source Source string.
 * @param ends Token end-offset buffer.
 * @param initialOffset Start offset of token 0 in source.
 *
 * @returns 3 if CDC found, 0 otherwise.
 */
export function cssCdcLength(
    types: Uint8Array,
    offset: number,
    tokenCount: number,
    source: string,
    ends: Uint32Array,
    initialOffset: number,
): number {
    if (offset + 2 >= tokenCount) {
        return 0;
    }
    if (types[offset] !== TokenType.Hyphen || types[offset + 1] !== TokenType.Hyphen) {
        return 0;
    }
    if (types[offset + 2] !== TokenType.Symbol) {
        return 0;
    }
    // Verify it's '>'
    const start = tokenStart(ends, offset + 2, initialOffset);
    if (source.charCodeAt(start) !== CHAR_GREATER_THAN) {
        return 0;
    }
    return 3;
}

/**
 * Whether the token at `offset` is a trivial 1:1 CSS token (colon, semicolon,
 * comma, parentheses, square brackets, or braces).
 *
 * @param types Token type buffer.
 * @param offset Token index to check.
 * @param tokenCount Total valid tokens.
 *
 * @returns 1 if it's a trivial token, 0 otherwise.
 */
export function cssTrivialTokenLength(
    types: Uint8Array,
    offset: number,
    tokenCount: number,
): number {
    ensureTables();

    if (offset >= tokenCount) {
        return 0;
    }

    return IS_TRIVIAL_TOKEN![types[offset]];
}
