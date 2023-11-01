/**
 * @file Tokenizing logic for ident-like tokens
 */

import { type TokenizerContextFunction } from '../../common/types/function-prototypes';
import { consumeIndentSequence } from './ident-sequence';
import { consumeUrlToken } from './url-token';
import { type TokenizerContext } from '../../common/context';
import { CodePoint } from '../../common/enums/code-points';
import { TokenType } from '../../common/enums/token-types';

const URL_FUNCTION_HASH = 193422222; // getStringHash('url')

/**
 * § 4.3.4. Consume an ident-like token
 *
 * Consume an ident-like token from a stream of code points. It returns an <ident-token>, <function-token>, <url-token>,
 * or <bad-url-token>.
 *
 * @param context Reference to the tokenizer context instance
 * @see {@link https://www.w3.org/TR/css-syntax-3/#consume-an-ident-like-token}
 * @note We extended the algorithm to allow custom function handlers, but the tokenizer still strictly follows the spec.
 */
export const consumeIdentLikeToken: TokenizerContextFunction = (context: TokenizerContext): void => {
    // Consume an ident sequence, and let string be the result.
    const start = context.offset;

    consumeIndentSequence(context);

    // If the ident sequence is followed by U+0028 LEFT PARENTHESIS ((), consume it as a function:
    if (context.code === CodePoint.LeftParenthesis) {
        // First, store the function’s name hash
        const fnHash = context.getHashFrom(start);

        // Consume the opening parenthesis.
        context.consumeCodePoint();

        // URL
        if (fnHash === URL_FUNCTION_HASH) {
            // While the next two input code points are whitespace, consume the next input code point
            // If the next one or two input code points are U+0022 QUOTATION MARK ("), U+0027 APOSTROPHE ('), or
            // whitespace followed by U+0022 QUOTATION MARK (") or U+0027 APOSTROPHE ('), then create a <function-token>
            // with its value set to string and return it.

            // ! Different from the spec, but technically it is enough to check the next non-whitespace code point
            const nextNonWsCode = context.getNextNonWsCode();

            if (nextNonWsCode === CodePoint.QuotationMark || nextNonWsCode === CodePoint.Apostrophe) {
                context.onToken(TokenType.Function, start, context.offset);
                return;
            }

            // Otherwise, consume a url token, and return it.
            consumeUrlToken(context, start);
            return;
        }

        // This is a good time to call custom function handlers, if any.
        // ! This is not part of the spec, but it's a good way to extend the tokenizer and if you didn't added any
        // ! custom function handler, it will not affect the tokenizer in any way, it still strictly follows the spec.
        // For performance reasons, we use `has` and `get` separately to avoid declaring a new variable every time here
        if (context.hasFunctionHandler(fnHash)) {
            // Return the <function-token>.
            context.onToken(TokenType.Function, start, context.offset);

            // Consume the function body
            // It's safe to call the handler directly because we already checked if it exists
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            context.getFunctionHandler(fnHash)!(context);
            return;
        }

        // Otherwise, if the next input code point is U+0028 LEFT PARENTHESIS ((), consume it. Create a <function-token>
        // with its value set to string and return it.
        context.onToken(TokenType.Function, start, context.offset);
        return;
    }

    // Otherwise, create an <ident-token> with its value set to string and return it.
    context.onToken(TokenType.Ident, start, context.offset);
};
