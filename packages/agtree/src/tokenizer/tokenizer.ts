/**
 * Token types.
 */
export const enum TokenType {
    /**
     * End of file (end of input).
     */
    Eof,

    /**
     * Whitespace.
     */
    Whitespace,

    /**
     * Line break (`\r\n` or just `\n`)
     */
    LineBreak,

    /**
     * Escaped character, e.g. `\'`, `\"`, `\\`, etc.
     */
    Escaped,

    /**
     * Identifier.
     * Any character sequence that contains letters, numbers, hyphens, and underscores.
     */
    Ident,

    /**
     * Cosmetic rule separator, e.g. `##`.
     */
    CosmeticSeparator,

    /**
     * Allowlist cosmetic rule separator, e.g. `#@#`.
     */
    AllowlistCosmeticSeparator,

    /**
     * Raw content after cosmetic rule separator.
     * For example, no need to tokenize CSS with this tokenizer after the `##`, `#?#`, etc. separators,
     * so we use this token type as an optimization strategy.
     */
    RawContent,

    /**
     * Equals: `=`.
     */
    EqualsSign,

    /**
     * Slash: `/`.
     */
    Slash,

    /**
     * Dollar: `$`.
     */
    DollarSign,

    /**
     * Comma: `,`.
     */
    Comma,

    /**
     * Open parenthesis: `(`.
     */
    OpenParen,

    /**
     * Close parenthesis: `)`.
     */
    CloseParen,

    /**
     * Open brace: `{`.
     */
    OpenBrace,

    /**
     * Close brace: `}`.
     */
    CloseBrace,

    /**
     * Open square: `[`.
     */
    OpenSquare,

    /**
     * Close square: `]`.
     */
    CloseSquare,

    /**
     * Pipe: `|`.
     */
    Pipe,

    /**
     * At: `@`.
     */
    AtSign,

    /**
     * Asterisk: `*`.
     */
    Asterisk,

    /**
     * Quote: `"`.
     */
    Quote,

    /**
     * Apostrophe: `'`.
     */
    Apostrophe,

    /**
     * Exclamation: `!`.
     */
    ExclamationMark,

    /**
     * Hashmark: `#`.
     */
    HashMark,

    /**
     * Plus: `+`.
     */
    PlusSign,

    /**
     * And: `&`.
     */
    AndSign,

    /**
     * Tilde: `~`.
     */
    Tilde,

    /**
     * Caret: `^`.
     */
    Caret,

    /**
     * Dot: `.`.
     */
    Dot,

    /**
     * Semicolon: `;`.
     */
    Semicolon,

    /**
     * Any other character.
     */
    Symbol,
}

/**
 * Checks if a character is an identifier character.
 *
 * @param c The character code to check.
 *
 * @returns `true` if the character is an identifier character, `false` otherwise.
 */
const isIdentChar = (c: number): boolean => {
    return (
        (c >= 48 && c <= 57) // 0-9
        || (c >= 65 && c <= 90) // A-Z
        || (c >= 97 && c <= 122) // a-z
        || c === 45 || c === 95 // - _
    );
};

const LF_RAW = '\n';

const SPACE = ' '.charCodeAt(0);
const TAB = '\t'.charCodeAt(0);
const CR = '\r'.charCodeAt(0);
const LF = LF_RAW.charCodeAt(0);
const FF = '\f'.charCodeAt(0);
const BACKSLASH = '\\'.charCodeAt(0);
const DOLLAR_SIGN = '$'.charCodeAt(0);
const SLASH = '/'.charCodeAt(0);
const EQUALS_SIGN = '='.charCodeAt(0);
const COMMA = ','.charCodeAt(0);
const OPEN_PAREN = '('.charCodeAt(0);
const CLOSE_PAREN = ')'.charCodeAt(0);
const OPEN_BRACE = '{'.charCodeAt(0);
const CLOSE_BRACE = '}'.charCodeAt(0);
const OPEN_SQUARE = '['.charCodeAt(0);
const CLOSE_SQUARE = ']'.charCodeAt(0);
const APOSTROPHE = "'".charCodeAt(0);
const QUOTE = '"'.charCodeAt(0);
const HASHMARK = '#'.charCodeAt(0);
const QUESTION_MARK = '?'.charCodeAt(0);
const PERCENT = '%'.charCodeAt(0);
const AT_SIGN = '@'.charCodeAt(0);
const ASTERISK = '*'.charCodeAt(0);
const PIPE = '|'.charCodeAt(0);
const EXCLAMATION_MARK = '!'.charCodeAt(0);
const PLUS_SIGN = '+'.charCodeAt(0);
const AND_SIGN = '&'.charCodeAt(0);
const TILDE = '~'.charCodeAt(0);
const CARET = '^'.charCodeAt(0);
const DOT = '.'.charCodeAt(0);
const SEMICOLON = ';'.charCodeAt(0);

/**
 * Function to stop tokenization.
 * Does not have effect on EOF.
 */
type StopFunction = () => void;

/**
 * Function to skip the current rule.
 * Does not have effect on EOF.
 */
type SkipFunction = () => void;

/**
 * Function to jump to a specific relative position.
 * If the position is out of bounds, it will be clamped.
 * Does not have effect on EOF.
 *
 * @param count The number of positions to jump.
 */
type JumpFunction = (count: number) => void;

/**
 * Callback function for tokenization.
 *
 * @param token The token type.
 * @param start The start position of the token.
 * @param end The end position of the token.
 * @param stop The function to stop tokenization.
 * @param skip The function to skip the current rule.
 * @param jump The function to jump to a specific relative position.
 */
export type OnTokenCallback = (
    token: TokenType,
    start: number,
    end: number,
    stop: StopFunction,
    skip: SkipFunction,
    jump: JumpFunction,
) => void;

/**
 * Tokenizes a string.
 *
 * @param string The string to tokenize.
 * @param onToken The callback function to handle tokens.
 */
export const tokenize = (string: string, onToken: OnTokenCallback) => {
    const { length } = string;

    let i = 0;
    let cosmeticRule = false;

    /**
     * Stops tokenization.
     * Does not have effect on EOF.
     */
    const stop: StopFunction = () => {
        i = length;
    };

    /**
     * Skips the current rule.
     * Does not have effect on EOF.
     */
    const skip: SkipFunction = () => {
        // it is more efficient to use indexOf here
        let index = string.indexOf(LF_RAW, i);

        if (index === -1) {
            i = length;
            return;
        }

        // handle \r\n
        if (i > 0 && string.charCodeAt(i - 1) === CR) {
            index -= 1;
        }

        i = index;
    };

    /**
     * Jumps to a specific relative position.
     * If the position is out of bounds, it will be clamped.
     * Does not have effect on EOF.
     *
     * @param count The number of positions to jump.
     */
    const jump: JumpFunction = (count: number) => {
        i = Math.max(0, Math.min(i + count, length));
    };

    /**
     * Emits raw content.
     */
    const emitRawContent = () => {
        const start = i;
        skip();
        onToken(TokenType.RawContent, start, i, stop, skip, jump);
    };

    while (i < length) {
        let c = string.charCodeAt(i);

        switch (c) {
            case SPACE:
            case TAB: {
                const start = i;
                i += 1;

                while (i < length) {
                    c = string.charCodeAt(i);

                    if (c !== SPACE && c !== TAB) {
                        break;
                    }

                    i += 1;
                }

                onToken(TokenType.Whitespace, start, i, stop, skip, jump);
                break;
            }

            case CR: {
                // reset rule info when reached a line break
                cosmeticRule = false;

                if (string.charCodeAt(i + 1) === LF) {
                    onToken(TokenType.LineBreak, i, i + 2, stop, skip, jump);
                    i += 2;
                    break;
                }

                onToken(TokenType.LineBreak, i, i + 1, stop, skip, jump);
                i += 1;
                break;
            }

            case LF:
            case FF: {
                // reset rule info when reached a line break
                cosmeticRule = false;

                onToken(TokenType.LineBreak, i, i + 1, stop, skip, jump);
                i += 1;
                break;
            }

            case BACKSLASH: {
                onToken(TokenType.Escaped, i, i + 2, stop, skip, jump);
                i += 2;
                break;
            }

            case HASHMARK: {
                if (cosmeticRule) {
                    onToken(TokenType.HashMark, i, i + 1, stop, skip, jump);
                    i += 1;
                    break;
                }

                const next = string.charCodeAt(i + 1);

                if (next === HASHMARK) {
                    // ##
                    onToken(TokenType.CosmeticSeparator, i, i + 2, stop, skip, jump);
                    i += 2;
                    emitRawContent();
                    break;
                } else if (next === QUESTION_MARK && string.charCodeAt(i + 2) === HASHMARK) {
                    // #?#
                    onToken(TokenType.CosmeticSeparator, i, i + 3, stop, skip, jump);
                    i += 3;
                    emitRawContent();
                    break;
                } else if (next === PERCENT && string.charCodeAt(i + 2) === HASHMARK) {
                    // #%#
                    onToken(TokenType.CosmeticSeparator, i, i + 3, stop, skip, jump);
                    i += 3;
                    // lets tokenize content
                    cosmeticRule = true;
                    break;
                } else if (next === DOLLAR_SIGN) {
                    if (string.charCodeAt(i + 2) === HASHMARK) {
                        // #$#
                        onToken(TokenType.CosmeticSeparator, i, i + 3, stop, skip, jump);
                        i += 3;
                        emitRawContent();
                        break;
                    }
                    if (string.charCodeAt(i + 2) === QUESTION_MARK && string.charCodeAt(i + 3) === HASHMARK) {
                        // #$?#
                        onToken(TokenType.CosmeticSeparator, i, i + 4, stop, skip, jump);
                        i += 4;
                        emitRawContent();
                        break;
                    }
                } else if (next === AT_SIGN) {
                    if (string.charCodeAt(i + 2) === HASHMARK) {
                        // #@#
                        onToken(TokenType.AllowlistCosmeticSeparator, i, i + 3, stop, skip, jump);
                        i += 3;
                        emitRawContent();
                        break;
                    }
                    if (string.charCodeAt(i + 2) === QUESTION_MARK && string.charCodeAt(i + 3) === HASHMARK) {
                        // #@?#
                        onToken(TokenType.AllowlistCosmeticSeparator, i, i + 4, stop, skip, jump);
                        i += 4;
                        emitRawContent();
                        break;
                    }
                    if (string.charCodeAt(i + 2) === PERCENT && string.charCodeAt(i + 3) === HASHMARK) {
                        // #@%#
                        onToken(TokenType.AllowlistCosmeticSeparator, i, i + 4, stop, skip, jump);
                        i += 4;
                        // lets tokenize content
                        cosmeticRule = true;
                        break;
                    }
                    if (string.charCodeAt(i + 2) === DOLLAR_SIGN) {
                        if (string.charCodeAt(i + 3) === HASHMARK) {
                            // #@$#
                            onToken(TokenType.AllowlistCosmeticSeparator, i, i + 4, stop, skip, jump);
                            i += 4;
                            emitRawContent();
                            break;
                        }
                        if (string.charCodeAt(i + 3) === QUESTION_MARK && string.charCodeAt(i + 4) === HASHMARK) {
                            // #@$?#
                            onToken(TokenType.AllowlistCosmeticSeparator, i, i + 5, stop, skip, jump);
                            i += 5;
                            emitRawContent();
                            break;
                        }
                    }
                }
                onToken(TokenType.Symbol, i, i + 1, stop, skip, jump);
                i += 1;
                break;
            }

            case DOLLAR_SIGN: {
                if (cosmeticRule) {
                    onToken(TokenType.DollarSign, i, i + 1, stop, skip, jump);
                    i += 1;
                    break;
                }

                const next = string.charCodeAt(i + 1);

                if (next === DOLLAR_SIGN) {
                    // $$
                    onToken(TokenType.CosmeticSeparator, i, i + 2, stop, skip, jump);
                    i += 2;
                    emitRawContent();
                    break;
                } else if (next === AT_SIGN && string.charCodeAt(i + 2) === DOLLAR_SIGN) {
                    // $@$
                    onToken(TokenType.AllowlistCosmeticSeparator, i, i + 3, stop, skip, jump);
                    i += 3;
                    emitRawContent();
                    break;
                } else {
                    onToken(TokenType.DollarSign, i, i + 1, stop, skip, jump);
                    i += 1;
                    break;
                }
            }

            case SLASH:
                onToken(TokenType.Slash, i, i + 1, stop, skip, jump);
                i += 1;
                break;

            case EQUALS_SIGN:
                onToken(TokenType.EqualsSign, i, i + 1, stop, skip, jump);
                i += 1;
                break;

            case COMMA:
                onToken(TokenType.Comma, i, i + 1, stop, skip, jump);
                i += 1;
                break;

            case OPEN_PAREN:
                onToken(TokenType.OpenParen, i, i + 1, stop, skip, jump);
                i += 1;
                break;

            case CLOSE_PAREN:
                onToken(TokenType.CloseParen, i, i + 1, stop, skip, jump);
                i += 1;
                break;

            case OPEN_BRACE:
                onToken(TokenType.OpenBrace, i, i + 1, stop, skip, jump);
                i += 1;
                break;

            case CLOSE_BRACE:
                onToken(TokenType.CloseBrace, i, i + 1, stop, skip, jump);
                i += 1;
                break;

            case OPEN_SQUARE:
                onToken(TokenType.OpenSquare, i, i + 1, stop, skip, jump);
                i += 1;
                break;

            case CLOSE_SQUARE:
                onToken(TokenType.CloseSquare, i, i + 1, stop, skip, jump);
                i += 1;
                break;

            case PIPE:
                onToken(TokenType.Pipe, i, i + 1, stop, skip, jump);
                i += 1;
                break;

            case AT_SIGN:
                onToken(TokenType.AtSign, i, i + 1, stop, skip, jump);
                i += 1;
                break;

            case ASTERISK:
                onToken(TokenType.Asterisk, i, i + 1, stop, skip, jump);
                i += 1;
                break;

            case QUOTE:
                onToken(TokenType.Quote, i, i + 1, stop, skip, jump);
                i += 1;
                break;

            case APOSTROPHE:
                onToken(TokenType.Apostrophe, i, i + 1, stop, skip, jump);
                i += 1;
                break;

            case EXCLAMATION_MARK:
                onToken(TokenType.ExclamationMark, i, i + 1, stop, skip, jump);
                i += 1;
                break;

            case PLUS_SIGN:
                onToken(TokenType.PlusSign, i, i + 1, stop, skip, jump);
                i += 1;
                break;

            case AND_SIGN:
                onToken(TokenType.AndSign, i, i + 1, stop, skip, jump);
                i += 1;
                break;

            case TILDE:
                onToken(TokenType.Tilde, i, i + 1, stop, skip, jump);
                i += 1;
                break;

            case CARET:
                onToken(TokenType.Caret, i, i + 1, stop, skip, jump);
                i += 1;
                break;

            case DOT:
                onToken(TokenType.Dot, i, i + 1, stop, skip, jump);
                i += 1;
                break;

            case SEMICOLON:
                onToken(TokenType.Semicolon, i, i + 1, stop, skip, jump);
                i += 1;
                break;

            default: {
                if (isIdentChar(c)) {
                    const start = i;
                    i += 1;

                    while (i < length && isIdentChar(string.charCodeAt(i))) {
                        i += 1;
                    }

                    onToken(TokenType.Ident, start, i, stop, skip, jump);
                    break;
                }

                onToken(TokenType.Symbol, i, i + 1, stop, skip, jump);
                i += 1;
                break;
            }
        }
    }

    // Emit EOF token. jump/skip/stop are inert here, included for API consistency.
    onToken(TokenType.Eof, i, i, stop, skip, jump);
};
