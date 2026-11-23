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
 * Finds the end of the `:xpath()` pseudo-class argument.
 *
 * XPath 1.0 literals can be single-quoted or double-quoted, and they have no escape
 * sequences. Only the matching quotation mark closes a literal, so a reverse solidus
 * inside a literal is a plain character. Outside a literal a reverse solidus escapes
 * the next code point, except a quotation mark: a quotation mark starts a literal
 * even after a reverse solidus, because after CSS unescaping it delimits a literal.
 *
 * A CSS-escaped quotation mark may be a plain character of a malformed argument
 * instead of the start of a literal, e.g. in `:xpath(//div[contains(text(),\')])`.
 * If the literal it opens does not close before the end of the source, the scan is
 * repeated with this quotation mark treated as plain text. Any other quotation mark
 * must close its literal: a literal that is not closed leaves the argument
 * unterminated, so the missing parenthesis is reported instead of being hidden.
 *
 * @param context Reference to the tokenizer context instance, positioned at the start
 * of the argument.
 *
 * @returns Number of code points in the argument, i.e. the offset of its closing
 * parenthesis relative to the argument start. If the parenthesis is missing, the rest
 * of the source is returned.
 */
const findArgumentEnd = (context: TokenizerContext): number => {
    const length = context.length - context.offset;

    // Positions of CSS-escaped quotation marks which must stay plain text, because the
    // scan reached the end of the source inside the literal they started
    const plainQuotes = new Set<number>();

    for (;;) {
        // Parenthesis balance: 1, because we start after the opening parenthesis:
        // :xpath(param)
        //        ^ we starts from here, so we already have 1 open parenthesis
        let balance = 1;

        // The quotation mark of the currently open XPath literal, if any
        let stringQuote: number | null = null;

        // The position of the quotation mark which opened the currently open literal
        let openingQuote = -1;

        // Whether the quotation mark which opened the currently open literal is CSS-escaped
        let openingQuoteEscaped = false;

        // XPath literals have no escape sequences, so escapes are tracked only outside
        // literals. Two reverse solidi in a row cancel each other.
        let escaped = false;

        // Consume until we find the closing parenthesis or we reach the end of the source
        for (let index = 0; index < length; index += 1) {
            const code = context.getRelativeCode(index);

            if (stringQuote !== null) {
                // Inside a literal, only the matching quotation mark closes the literal
                if (code === stringQuote) {
                    stringQuote = null;
                }
            } else if (code === CodePoint.Apostrophe || code === CodePoint.QuotationMark) {
                // A quotation mark starts a literal even after a reverse solidus, because
                // XPath literals have no escape sequences. The reverse solidus is consumed
                // and must not escape the code point after the quotation mark.
                const quoteEscaped = escaped;
                escaped = false;

                if (!plainQuotes.has(index)) {
                    stringQuote = code;
                    openingQuote = index;
                    openingQuoteEscaped = quoteEscaped;
                }
            } else if (escaped) {
                // The escaped code point is plain text, so it must not change the balance
                escaped = false;
            } else if (code === CodePoint.ReverseSolidus) {
                // Outside a literal, a reverse solidus escapes the next code point
                escaped = true;
            } else if (code === CodePoint.LeftParenthesis) {
                // If we find an unescaped opening parenthesis, we increase the balance
                balance += 1;
            } else if (code === CodePoint.RightParenthesis) {
                // If we find an unescaped closing parenthesis, we decrease the balance
                balance -= 1;

                // If the balance is 0, it means that we found the closing parenthesis of
                // the pseudo-class
                if (balance === 0) {
                    return index;
                }
            }
        }

        if (stringQuote === null) {
            return length;
        }

        // A plain quotation mark that never closes is a typo, not a literal. The argument
        // stays unterminated, so the closing parenthesis inside the literal is not
        // tokenized and the parser reports the error.
        if (!openingQuoteEscaped) {
            return length;
        }

        // The escaped quotation mark is plain text, so the scan is repeated without it
        plainQuotes.add(openingQuote);
    }
};

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

    // Don't forget to report already consumed whitespace chars as delim-tokens (if any)
    // Note: we handle the parameter characters as delim-tokens, this is why we don't need to report them here
    // as whitespace-tokens
    for (let i = start; i < context.offset; i += 1) {
        context.onToken(TokenType.Delim, i, i + 1, undefined, context.stop);
    }

    // :xpath() is a bit tricky, because it can contain unescaped parentheses inside
    // XPath literals, like this:
    // :xpath(//div[@class="foo(bar)"])
    // but the whole XPath expression does not need to be a string in this case.
    // The argument end is found before consuming anything, so an unterminated literal
    // can be rescanned.
    const argumentLength = findArgumentEnd(context);

    // Consume the argument as delim-tokens, leaving the closing parenthesis to the
    // standard tokenizer
    for (let argumentIndex = 0; argumentIndex < argumentLength && !context.isEof(); argumentIndex += 1) {
        context.consumeTrivialToken(TokenType.Delim);
    }
};
