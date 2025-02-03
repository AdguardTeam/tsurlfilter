/**
 * @file Tokenizing logic for whitespace
 */

import { type TokenizerContextFunction } from '../../common/types/function-prototypes';
import { type TokenizerContext } from '../../common/context';
import { TokenType } from '../../common/enums/token-types';

/**
 * § 4.3.1. Consume a token (whitespace)
 *
 * @see {@link https://www.w3.org/TR/css-syntax-3/#consume-token}
 * @param context Reference to the tokenizer context instance
 */
export const consumeWhitespaceToken: TokenizerContextFunction = (context: TokenizerContext): void => {
    // Consume as much whitespace as possible. Return a <whitespace-token>.
    const start = context.offset;

    context.consumeWhitespace();

    context.onToken(TokenType.Whitespace, start, context.offset, undefined, context.stop);
};
