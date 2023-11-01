/**
 * @file Possible CSS token types, as defined in the CSS Syntax Module Level 3.
 *
 * ! Strictly follows the spec.
 *
 * @see {@link https://www.w3.org/TR/css-syntax-3/#tokenization}
 */

export enum TokenType {
    Eof = 0,
    Ident = 1,
    Function = 2,
    AtKeyword = 3,
    Hash = 4,
    String = 5,
    BadString = 6,
    Url = 7,
    BadUrl = 8,
    Delim = 9,
    Number = 10,
    Percentage = 11,
    Dimension = 12,
    Whitespace = 13,
    Cdo = 14,
    Cdc = 15,
    Colon = 16,
    Semicolon = 17,
    Comma = 18,
    OpenSquareBracket = 19,
    CloseSquareBracket = 20,
    OpenParenthesis = 21,
    CloseParenthesis = 22,
    OpenCurlyBracket = 23,
    CloseCurlyBracket = 24,
    Comment = 25,
}
