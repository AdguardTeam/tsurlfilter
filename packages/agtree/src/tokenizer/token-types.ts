/**
 * Token types.
 */
export const enum TokenType {
    /**
     * End of file (end of input).
     */
    Eof = 0,

    /**
     * Whitespace.
     */
    Whitespace = 1,

    /**
     * Line break (`\r\n` or just `\n`)
     */
    LineBreak = 2,

    /**
     * Escaped character, e.g. `\'`, `\"`, `\\`, etc.
     */
    Escaped = 3,

    /**
     * Identifier.
     * Any character sequence that contains letters, numbers, hyphens, and underscores.
     */
    Ident = 4,

    /**
     * Equals: `=`.
     */
    EqualsSign = 5,

    /**
     * Slash: `/`.
     */
    Slash = 6,

    /**
     * Dollar: `$`.
     */
    DollarSign = 7,

    /**
     * Comma: `,`.
     */
    Comma = 8,

    /**
     * Open parenthesis: `(`.
     */
    OpenParen = 9,

    /**
     * Close parenthesis: `)`.
     */
    CloseParen = 10,

    /**
     * Open brace: `{`.
     */
    OpenBrace = 11,

    /**
     * Close brace: `}`.
     */
    CloseBrace = 12,

    /**
     * Open square: `[`.
     */
    OpenSquare = 13,

    /**
     * Close square: `]`.
     */
    CloseSquare = 14,

    /**
     * Pipe: `|`.
     */
    Pipe = 15,

    /**
     * At: `@`.
     */
    AtSign = 16,

    /**
     * Asterisk: `*`.
     */
    Asterisk = 17,

    /**
     * Quote: `"`.
     */
    Quote = 18,

    /**
     * Apostrophe: `'`.
     */
    Apostrophe = 19,

    /**
     * Exclamation: `!`.
     */
    ExclamationMark = 20,

    /**
     * Hashmark: `#`.
     */
    HashMark = 21,

    /**
     * Plus: `+`.
     */
    PlusSign = 22,

    /**
     * And: `&`.
     */
    AndSign = 23,

    /**
     * Tilde: `~`.
     */
    Tilde = 24,

    /**
     * Caret: `^`.
     */
    Caret = 25,

    /**
     * Dot: `.`.
     */
    Dot = 26,

    /**
     * Colon: `:`.
     */
    Colon = 27,

    /**
     * Semicolon: `;`.
     */
    Semicolon = 28,

    /**
     * Question mark: `?`.
     */
    QuestionMark = 29,

    /**
     * Percent: `%`.
     */
    Percent = 30,

    /**
     * Unicode sequence (non-ASCII characters with charCode >= 0x80).
     * Collected as consecutive unicode characters for performance.
     */
    UnicodeSequence = 31,

    /**
     * Any other character.
     */
    Symbol = 32,
}

/**
 * Token type name lookup table for base names.
 */
const TOKEN_NAMES: Record<TokenType, string> = {
    [TokenType.Eof]: 'eof',
    [TokenType.Whitespace]: 'whitespace',
    [TokenType.LineBreak]: 'line-break',
    [TokenType.Escaped]: 'escaped',
    [TokenType.Ident]: 'ident',
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
    [TokenType.UnicodeSequence]: 'unicode-sequence',
    [TokenType.Symbol]: 'symbol',
};

/**
 * Get the base name for a token type.
 *
 * @param type - Token type
 * @returns Base name string (e.g., "eof", "whitespace", "=")
 */
export function getBaseTokenName(type: TokenType): string {
    return TOKEN_NAMES[type] ?? 'unknown';
}

/**
 * Get the formatted name for a token type.
 *
 * @param type - Token type
 * @returns Formatted name string (e.g., "<eof-token>", "<whitespace-token>")
 */
export function getFormattedTokenName(type: TokenType): string {
    const baseName = getBaseTokenName(type);
    return baseName === 'unknown' ? '<unknown-token>' : `<${baseName}-token>`;
}
