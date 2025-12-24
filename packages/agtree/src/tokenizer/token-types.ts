/**
 * Unique symbol to brand TokenType.
 */
declare const TokenTypeBrand: unique symbol;

/**
 * Branded type for token type values.
 */
export type TokenType = number & {
    readonly [TokenTypeBrand]: true;
};

/**
 * Token types.
 */
// eslint-disable-next-line @typescript-eslint/no-redeclare
export const TokenType = {
    /**
     * End of file (end of input).
     */
    Eof: 0 as TokenType,

    /**
     * Whitespace.
     */
    Whitespace: 1 as TokenType,

    /**
     * Line break (`\r\n` or just `\n`)
     */
    LineBreak: 2 as TokenType,

    /**
     * Escaped character, e.g. `\'`, `\"`, `\\`, etc.
     */
    Escaped: 3 as TokenType,

    /**
     * Identifier.
     * Any character sequence that contains letters, numbers, hyphens, and underscores.
     */
    Ident: 4 as TokenType,

    /**
     * Cosmetic rule separator, e.g. `##`.
     */
    CosmeticSeparator: 5 as TokenType,

    /**
     * Allowlist cosmetic rule separator, e.g. `#@#`.
     */
    AllowlistCosmeticSeparator: 6 as TokenType,

    /**
     * Raw content after cosmetic rule separator.
     * For example, no need to tokenize CSS with this tokenizer after the `##`, `#?#`, etc. separators,
     * so we use this token type as an optimization strategy.
     */
    RawContent: 7 as TokenType,

    /**
     * Equals: `=`.
     */
    EqualsSign: 8 as TokenType,

    /**
     * Slash: `/`.
     */
    Slash: 9 as TokenType,

    /**
     * Dollar: `$`.
     */
    DollarSign: 10 as TokenType,

    /**
     * Comma: `,`.
     */
    Comma: 11 as TokenType,

    /**
     * Open parenthesis: `(`.
     */
    OpenParen: 12 as TokenType,

    /**
     * Close parenthesis: `)`.
     */
    CloseParen: 13 as TokenType,

    /**
     * Open brace: `{`.
     */
    OpenBrace: 14 as TokenType,

    /**
     * Close brace: `}`.
     */
    CloseBrace: 15 as TokenType,

    /**
     * Open square: `[`.
     */
    OpenSquare: 16 as TokenType,

    /**
     * Close square: `]`.
     */
    CloseSquare: 17 as TokenType,

    /**
     * Pipe: `|`.
     */
    Pipe: 18 as TokenType,

    /**
     * At: `@`.
     */
    AtSign: 19 as TokenType,

    /**
     * Asterisk: `*`.
     */
    Asterisk: 20 as TokenType,

    /**
     * Quote: `"`.
     */
    Quote: 21 as TokenType,

    /**
     * Apostrophe: `'`.
     */
    Apostrophe: 22 as TokenType,

    /**
     * Exclamation: `!`.
     */
    ExclamationMark: 23 as TokenType,

    /**
     * Hashmark: `#`.
     */
    HashMark: 24 as TokenType,

    /**
     * Plus: `+`.
     */
    PlusSign: 25 as TokenType,

    /**
     * And: `&`.
     */
    AndSign: 26 as TokenType,

    /**
     * Tilde: `~`.
     */
    Tilde: 27 as TokenType,

    /**
     * Caret: `^`.
     */
    Caret: 28 as TokenType,

    /**
     * Dot: `.`.
     */
    Dot: 29 as TokenType,

    /**
     * Semicolon: `;`.
     */
    Semicolon: 30 as TokenType,

    /**
     * Any other character.
     */
    Symbol: 31 as TokenType,
};

const UNKNOWN_TOKEN_NAME = 'unknown';

/**
 * Array of token type names indexed by token type value
 */
const TOKEN_NAMES: readonly string[] = [
    'eof',
    'whitespace',
    'line-break',
    'escaped',
    'ident',
    'cosmetic-separator',
    'allowlist-cosmetic-separator',
    'raw-content',
    '=',
    '/',
    '$',
    ',',
    '(',
    ')',
    '{',
    '}',
    '[',
    ']',
    '|',
    '@',
    '*',
    '"',
    "'",
    '!',
    '#',
    '+',
    '&',
    '~',
    '^',
    '.',
    ';',
    'symbol',
];

/**
 * Get base token name by token type
 *
 * @param type Token type
 *
 * @returns Base token name or 'unknown' if token type is unknown
 *
 * @example
 * ```ts
 * getBaseTokenName(TokenType.Ident); // 'ident'
 * getBaseTokenName(-1); // 'unknown'
 * ```
 */
export const getBaseTokenName = (type: TokenType): string => {
    return TOKEN_NAMES[type] ?? UNKNOWN_TOKEN_NAME;
};

/**
 * Get formatted token name by token type
 *
 * @param type Token type
 *
 * @returns Formatted token name or `'<unknown-token>'` if token type is unknown
 *
 * @example
 * ```ts
 * getFormattedTokenName(TokenType.Ident); // '<ident-token>'
 * getFormattedTokenName(-1); // '<unknown-token>'
 * ```
 */
export const getFormattedTokenName = (type: TokenType): string => {
    return `<${getBaseTokenName(type)}-token>`;
};
