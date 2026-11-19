/**
 * @file Custom tokenizing logic for Extended CSS's `:xpath()` pseudo-class
 *
 * @note `:xpath()` is a bit tricky, because it can contain unescaped parentheses inside strings in the XPath
 * expression.
 */

import { type TokenizerContext } from '../../common/context';
import { CodePoint } from '../../common/enums/code-points';
import { TokenType } from '../../common/enums/token-types';
import { type TokenizerContextFunction } from '../../common/types/function-prototypes';

/**
 * Handler for the Extended CSS's `:xpath()` pseudo-class
 *
 * @param context Reference to the tokenizer context instance
 */
export const handleXpathExtendedCssPseudo: TokenizerContextFunction = (context: TokenizerContext): void => {
    // Save the current offset, because we will need it later
    const start = context.offset;

    // Consume as much whitespace as possible
    context.consumeWhitespace();

    // If the first non-whitespace code point is an apostrophe or a quotation mark, it means that we are dealing
    // with a string parameter.
    // In this case, we simply abort the custom handler here, and let the standard tokenizer handle the string and
    // everything that comes after it as specified in the spec.
    // This behavior is similar to the standard CSS's url() function, it is also handled differently if its parameter
    // is a string.
    if (context.code === CodePoint.Apostrophe || context.code === CodePoint.QuotationMark) {
        // Report whitespace tokens (if any)
        // It is important to report them, because we already consumed them - and the report is faster here than
        // a re-consume
        if (context.offset > start) {
            context.onToken(TokenType.Whitespace, start, context.offset, undefined, context.stop);
        }

        // We simply abort the custom handler
        return;
    }

    // Otherwise, we need to find the closing parenthesis based on the parenthesis balance
    // Parenthesis balance: 1, because we start after the opening parenthesis:
    // :xpath(param)
    //        ^ we starts from here, so we already have 1 open parenthesis
    let balance = 1;

    // Don't forget to report already consumed whitespace chars as delim-tokens (if any)
    // Note: we handle the parameter characters as delim-tokens, this is why we don't need to report them here
    // as whitespace-tokens
    for (let i = start; i < context.offset; i += 1) {
        context.onToken(TokenType.Delim, i, i + 1, undefined, context.stop);
    }

    // :xpath() is a bit tricky, because it can contain unescaped parentheses inside XPath literals, like this:
    // :xpath(//div[@class="foo(bar)"])
    // but the whole XPath expression does not need to be a string in this case.
    // XPath 1.0 literals can be single-quoted or double-quoted, so we store the quote that opened the literal.
    let stringQuote: number | null = null;

    // XPath literals have no escape sequences: inside a literal, a reverse solidus is a normal character, and only
    // the matching quotation mark closes the literal. Therefore we track escapes only outside literals.
    let escaped = false;

    // Consume until we find the closing parenthesis or we reach the end of the source
    while (!context.isEof()) {
        if (stringQuote !== null) {
            // Inside a literal, only the matching quotation mark closes the literal
            if (context.code === stringQuote) {
                stringQuote = null;
            }
        } else if (escaped) {
            // The escaped code point is plain text, so it must not open a literal or change the balance
            escaped = false;
        } else if (context.code === CodePoint.ReverseSolidus) {
            // A reverse solidus escapes the next code point. Two reverse solidi in a row cancel each other.
            escaped = true;
        } else if (context.code === CodePoint.Apostrophe || context.code === CodePoint.QuotationMark) {
            // If we find an unescaped quotation mark, we open a literal
            // It is important, because we should omit parentheses inside literals.
            stringQuote = context.code;
        } else if (context.code === CodePoint.LeftParenthesis) {
            // If we find an unescaped opening parenthesis, we increase the balance
            balance += 1;
        } else if (context.code === CodePoint.RightParenthesis) {
            // If we find an unescaped closing parenthesis, we decrease the balance
            balance -= 1;

            // If the balance is 0, it means that we found the closing parenthesis of the
            // pseudo-class
            if (balance === 0) {
                break;
            }
        }

        // Consume the current character as a delim-token
        context.consumeTrivialToken(TokenType.Delim);
    }
};
