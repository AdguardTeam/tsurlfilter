/**
 * @file CSS-level token kind enum for the converter's CSS cursor.
 *
 * Follows CSS Syntax Module Level 3 §4 tokenization.
 * Naming matches `@adguard/css-tokenizer`'s TokenType for consistency.
 *
 * @see {@link https://www.w3.org/TR/css-syntax-3/#tokenization}
 */

/**
 * CSS-level token categories as classified by {@link CssCursor}.
 */
export enum CssTokenKind {
    /**
     * End-of-input.
     */
    Eof = 0,
    /**
     * CSS `<ident-token>` — e.g. `div`, `contains`, `-ext-has`.
     */
    Ident = 1,
    /**
     * CSS `<function-token>` — ident followed by `(` — e.g. `has(`.
     */
    Function = 2,
    /**
     * CSS `<at-keyword-token>` — e.g. `@media`.
     */
    AtKeyword = 3,
    /**
     * CSS `<hash-token>` — e.g. `#foo`.
     */
    Hash = 4,
    /**
     * CSS `<string-token>` — properly closed quoted value.
     */
    String = 5,
    /**
     * CSS `<bad-string-token>` — string with unescaped newline.
     */
    BadString = 6,
    /**
     * CSS `<url-token>` — `url(...)` without quotes.
     */
    Url = 7,
    /**
     * CSS `<bad-url-token>` — malformed URL.
     */
    BadUrl = 8,
    /**
     * CSS `<delim-token>` — single code point not consumed as another type.
     */
    Delim = 9,
    /**
     * CSS `<number-token>`.
     */
    Number = 10,
    /**
     * CSS `<percentage-token>`.
     */
    Percentage = 11,
    /**
     * CSS `<dimension-token>`.
     */
    Dimension = 12,
    /**
     * CSS `<whitespace-token>`.
     */
    Whitespace = 13,
    /**
     * CSS `<CDO-token>` — `<!--`.
     */
    Cdo = 14,
    /**
     * CSS `<CDC-token>` — `-->`.
     */
    Cdc = 15,
    /**
     * Colon `:`.
     */
    Colon = 16,
    /**
     * Semicolon `;`.
     */
    Semicolon = 17,
    /**
     * Comma `,`.
     */
    Comma = 18,
    /**
     * Open square bracket `[`.
     */
    OpenSquareBracket = 19,
    /**
     * Close square bracket `]`.
     */
    CloseSquareBracket = 20,
    /**
     * Open parenthesis `(`.
     */
    OpenParenthesis = 21,
    /**
     * Close parenthesis `)`.
     */
    CloseParenthesis = 22,
    /**
     * Open curly bracket `{`.
     */
    OpenCurlyBracket = 23,
    /**
     * Close curly bracket `}`.
     */
    CloseCurlyBracket = 24,
    /**
     * CSS comment.
     */
    Comment = 25,
}
