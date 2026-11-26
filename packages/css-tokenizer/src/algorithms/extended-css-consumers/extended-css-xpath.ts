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
 * Finds the closing parenthesis of the `:xpath()` argument with the XPath 1.0
 * literal rules.
 *
 * XPath 1.0 literals can be single-quoted or double-quoted, and they have no escape
 * sequences. Only the matching quotation mark closes a literal, so a reverse solidus
 * inside a literal is a plain character. Outside a literal a reverse solidus escapes
 * the next code point, except a quotation mark: a quotation mark starts a literal
 * even after a reverse solidus, because after CSS unescaping it delimits a literal.
 *
 * @param context Reference to the tokenizer context instance, positioned at the start
 * of the argument.
 * @param length Length of the source after the argument start.
 *
 * @returns Offset of the closing parenthesis relative to the argument start, or `-1`
 * if the scan ends inside a literal or at the end of the source.
 */
const findXpathArgumentEnd = (context: TokenizerContext, length: number): number => {
    // Parenthesis balance: 1, because we start after the opening parenthesis:
    // :xpath(param)
    //        ^ we starts from here, so we already have 1 open parenthesis
    let balance = 1;

    // The quotation mark of the currently open XPath literal, if any
    let stringQuote: number | null = null;

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

            continue;
        }

        if (code === CodePoint.Apostrophe || code === CodePoint.QuotationMark) {
            // A quotation mark starts a literal even after a reverse solidus, because
            // XPath literals have no escape sequences. The reverse solidus is consumed
            // and must not escape the code point after the quotation mark.
            stringQuote = code;
            escaped = false;

            continue;
        }

        if (escaped) {
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

    return -1;
};

/**
 * Finds the closing parenthesis of the `:xpath()` argument with the rules of the
 * handler which this fix replaces.
 *
 * The previous handler tracked only a plain double quotation mark and tested a single
 * preceding code unit for an escape. Such arguments are invalid XPath and never
 * matched anything, but their rules loaded, so they must keep loading. This scan is
 * used only when {@link findXpathArgumentEnd} does not find the closing parenthesis,
 * for example for `:xpath(//div[@a="x\""])`: the escaped `"` is plain text for the
 * previous handler, which closes the literal at the next `"`.
 *
 * @param context Reference to the tokenizer context instance, positioned at the start
 * of the argument.
 * @param length Length of the source after the argument start.
 *
 * @returns Offset of the closing parenthesis relative to the argument start, or
 * `length` if the parenthesis is missing.
 */
const findPreviousHandlerArgumentEnd = (context: TokenizerContext, length: number): number => {
    // Parenthesis balance: 1, because we start after the opening parenthesis
    let balance = 1;

    // Whether a double-quoted literal is open
    let inString = false;

    for (let index = 0; index < length; index += 1) {
        const code = context.getRelativeCode(index);

        // The previous handler tested only the code unit right before the current one
        const escaped = context.getRelativeCode(index - 1) === CodePoint.ReverseSolidus;

        if (code === CodePoint.QuotationMark && !escaped) {
            inString = !inString;
        }

        if (inString || escaped) {
            continue;
        }

        if (code === CodePoint.LeftParenthesis) {
            balance += 1;
        } else if (code === CodePoint.RightParenthesis) {
            balance -= 1;

            if (balance === 0) {
                return index;
            }
        }
    }

    return length;
};

/**
 * Finds the end of the `:xpath()` pseudo-class argument.
 *
 * The argument is scanned with the XPath 1.0 literal rules first, because they are
 * correct for a well-formed XPath expression. If that scan does not find the closing
 * parenthesis, the argument is scanned again with the rules of the previous handler,
 * so malformed arguments which loaded before this fix keep loading, for example
 * `:xpath(//div[@a="x\""])`. A plain double quotation mark that never closes keeps
 * the argument unterminated in both scans, so a missing parenthesis in a typo such as
 * `:xpath(//div[@a="x])` is reported instead of hidden.
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

    const xpathEnd = findXpathArgumentEnd(context, length);

    if (xpathEnd >= 0) {
        return xpathEnd;
    }

    return findPreviousHandlerArgumentEnd(context, length);
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
    // The argument end is found before consuming anything, so the scan can be repeated
    // with the previous handler's rules when the XPath rules do not find the end.
    const argumentLength = findArgumentEnd(context);

    // Consume the argument as delim-tokens, leaving the closing parenthesis to the
    // standard tokenizer
    for (let argumentIndex = 0; argumentIndex < argumentLength && !context.isEof(); argumentIndex += 1) {
        context.consumeTrivialToken(TokenType.Delim);
    }
};
