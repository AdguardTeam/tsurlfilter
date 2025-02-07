/**
 * @file CSS token names
 */

import { TokenType } from '../common/enums/token-types';

const UNKNOWN_TOKEN_NAME = 'unknown';

/**
 * Pairs of token types and their base names
 */
export const TOKEN_NAMES: Record<TokenType, string> = Object.freeze({
    [TokenType.Eof]: 'eof',
    [TokenType.Ident]: 'ident',
    [TokenType.Function]: 'function',
    [TokenType.AtKeyword]: 'at-keyword',
    [TokenType.Hash]: 'hash',
    [TokenType.String]: 'string',
    [TokenType.BadString]: 'bad-string',
    [TokenType.Url]: 'url',
    [TokenType.BadUrl]: 'bad-url',
    [TokenType.Delim]: 'delim',
    [TokenType.Number]: 'number',
    [TokenType.Percentage]: 'percentage',
    [TokenType.Dimension]: 'dimension',
    [TokenType.Whitespace]: 'whitespace',
    [TokenType.Cdo]: 'CDO',
    [TokenType.Cdc]: 'CDC',
    [TokenType.Colon]: 'colon',
    [TokenType.Semicolon]: 'semicolon',
    [TokenType.Comma]: 'comma',
    [TokenType.OpenSquareBracket]: '[',
    [TokenType.CloseSquareBracket]: ']',
    [TokenType.OpenParenthesis]: '(',
    [TokenType.CloseParenthesis]: ')',
    [TokenType.OpenCurlyBracket]: '{',
    [TokenType.CloseCurlyBracket]: '}',
    [TokenType.Comment]: 'comment',
});

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
