/**
 * Token types.
 *
 * The first five values are ordered deliberately so that set-membership for
 * common parser hot-paths reduces to a **single range comparison**:
 *
 * | Range check              | Set               | Use-case                      |
 * |--------------------------|-------------------|-------------------------------|
 * | `type <= Hyphen`     (≤1)| Letter, Hyphen    | CSS pseudo-class names        |
 * | `type <= Digit`      (≤2)| + Digit           | Adblock modifier/ident names  |
 * | `type <= Underscore` (≤3)| + Underscore      | Preprocessor variable names   |
 * | `type <= NonAscii`   (≤4)| + NonAscii        | Full CSS ident-part           |
 *
 * For the non-contiguous set `Letter | Underscore` (ident-start) use the
 * exported {@link IDENT_START_MASK} bitmask constant.
 */
export const enum TokenType {
    // ── Ident-part types (ordered for range checks, see table above) ─────────

    /**
     * Letter run: one or more ASCII letters (`[A-Za-z]+`).
     */
    Letter = 0,

    /**
     * Hyphen: `-`.
     * Emitted as a single-character token.
     */
    Hyphen = 1,

    /**
     * Digit run: one or more ASCII decimal digits (`[0-9]+`).
     */
    Digit = 2,

    /**
     * Underscore: `_`.
     * Emitted as a single-character token.
     */
    Underscore = 3,

    /**
     * Non-ASCII character (code point ≥ U+0080).
     * Emitted as a single-character token (one token per UTF-16 code unit).
     */
    NonAscii = 4,

    // ── Structural / infrastructure tokens ───────────────────────────────────

    /**
     * End of file (end of input).
     */
    Eof = 5,

    /**
     * Whitespace.
     */
    Whitespace = 6,

    /**
     * Line break (`\r\n` or just `\n`).
     */
    LineBreak = 7,

    /**
     * Escaped character, e.g. `\'`, `\"`, `\\`, etc.
     */
    Escaped = 8,

    /**
     * Any other unrecognised single ASCII character.
     */
    Symbol = 9,

    // ── Single-character punctuation tokens (direct-emit in tokenizer, ≥ 10) ─

    /**
     * Equals: `=`.
     */
    EqualsSign = 10,

    /**
     * Slash: `/`.
     */
    Slash = 11,

    /**
     * Dollar: `$`.
     */
    DollarSign = 12,

    /**
     * Comma: `,`.
     */
    Comma = 13,

    /**
     * Open parenthesis: `(`.
     */
    OpenParen = 14,

    /**
     * Close parenthesis: `)`.
     */
    CloseParen = 15,

    /**
     * Open brace: `{`.
     */
    OpenBrace = 16,

    /**
     * Close brace: `}`.
     */
    CloseBrace = 17,

    /**
     * Open square: `[`.
     */
    OpenSquare = 18,

    /**
     * Close square: `]`.
     */
    CloseSquare = 19,

    /**
     * Pipe: `|`.
     */
    Pipe = 20,

    /**
     * At: `@`.
     */
    AtSign = 21,

    /**
     * Asterisk: `*`.
     */
    Asterisk = 22,

    /**
     * Quote: `"`.
     */
    Quote = 23,

    /**
     * Apostrophe: `'`.
     */
    Apostrophe = 24,

    /**
     * Exclamation: `!`.
     */
    ExclamationMark = 25,

    /**
     * Hashmark: `#`.
     */
    HashMark = 26,

    /**
     * Plus: `+`.
     */
    PlusSign = 27,

    /**
     * And: `&`.
     */
    AndSign = 28,

    /**
     * Tilde: `~`.
     */
    Tilde = 29,

    /**
     * Caret: `^`.
     */
    Caret = 30,

    /**
     * Dot: `.`.
     */
    Dot = 31,

    /**
     * Colon: `:`.
     */
    Colon = 32,

    /**
     * Semicolon: `;`.
     */
    Semicolon = 33,

    /**
     * Question mark: `?`.
     */
    QuestionMark = 34,

    /**
     * Percent: `%`.
     */
    Percent = 35,
}

/**
 * Bitmask for the non-contiguous ident-start set: {@link TokenType.Letter} (0)
 * and {@link TokenType.Underscore} (3).
 *
 * Usage: `(IDENT_START_MASK >>> type) & 1` — non-zero iff `type` is Letter or Underscore.
 */
// eslint-disable-next-line no-bitwise
export const IDENT_START_MASK = (1 << TokenType.Letter) | (1 << TokenType.Underscore); // = 0b1001 = 9

/**
 * Token type name lookup table for base names.
 */
const TOKEN_NAMES: Record<TokenType, string> = {
    [TokenType.Eof]: 'eof',
    [TokenType.Whitespace]: 'whitespace',
    [TokenType.LineBreak]: 'line-break',
    [TokenType.Escaped]: 'escaped',
    [TokenType.Letter]: 'letter',
    [TokenType.Digit]: 'digit',
    [TokenType.EqualsSign]: 'equals',
    [TokenType.Slash]: 'slash',
    [TokenType.DollarSign]: 'dollar',
    [TokenType.Comma]: 'comma',
    [TokenType.OpenParen]: 'open-parenthesis',
    [TokenType.CloseParen]: 'close-parenthesis',
    [TokenType.OpenBrace]: 'open-brace',
    [TokenType.CloseBrace]: 'close-brace',
    [TokenType.OpenSquare]: 'open-square',
    [TokenType.CloseSquare]: 'close-square',
    [TokenType.Pipe]: 'pipe',
    [TokenType.AtSign]: 'at',
    [TokenType.Asterisk]: 'asterisk',
    [TokenType.Quote]: 'quote',
    [TokenType.Apostrophe]: 'apostrophe',
    [TokenType.ExclamationMark]: 'exclamation',
    [TokenType.HashMark]: 'hash',
    [TokenType.PlusSign]: 'plus',
    [TokenType.AndSign]: 'ampersand',
    [TokenType.Tilde]: 'tilde',
    [TokenType.Caret]: 'caret',
    [TokenType.Dot]: 'dot',
    [TokenType.Colon]: 'colon',
    [TokenType.Semicolon]: 'semicolon',
    [TokenType.QuestionMark]: 'question',
    [TokenType.Percent]: 'percent',
    [TokenType.Hyphen]: 'hyphen',
    [TokenType.NonAscii]: 'non-ascii',
    [TokenType.Symbol]: 'symbol',
    [TokenType.Underscore]: 'underscore',
};

/**
 * Get the base name for a token type.
 *
 * @param type Token type.
 *
 * @returns Base name string (e.g., "eof", "whitespace", "=").
 */
export function getBaseTokenName(type: TokenType): string {
    return TOKEN_NAMES[type] ?? 'unknown';
}

/**
 * Get the formatted name for a token type.
 *
 * @param type Token type.
 *
 * @returns Formatted name string (e.g., "<eof-token>", "<whitespace-token>").
 */
export function getFormattedTokenName(type: TokenType): string {
    const baseName = getBaseTokenName(type);
    return baseName === 'unknown' ? '<unknown-token>' : `<${baseName}-token>`;
}
