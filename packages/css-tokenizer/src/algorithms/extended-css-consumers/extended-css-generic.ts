/**
 * @file Custom tokenizing logic for Extended CSS's pseudo-classes
 */

import { type TokenizerContext } from '../../common/context';
import { CodePoint } from '../../common/enums/code-points';
import { TokenType } from '../../common/enums/token-types';
import { type TokenizerContextFunction } from '../../common/types/function-prototypes';

/**
 * Generic handler for the Extended CSS's pseudo-classes
 *
 * @param context Reference to the tokenizer context instance
 */
export const handleRegularExtendedCssPseudo: TokenizerContextFunction = (context: TokenizerContext): void => {
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
    // :contains(param)
    //           ^ we starts from here, so we already have 1 open parenthesis
    let balance = 1;

    // Don't forget to report already consumed whitespace chars as delim-tokens (if any)
    // Note: we handle the parameter characters as delim-tokens, this is why we don't need to report them here
    // as whitespace-tokens
    for (let i = start; i < context.offset; i += 1) {
        context.onToken(TokenType.Delim, i, i + 1, undefined, context.stop);
    }

    // The argument may be a regexp literal, e.g. `:has-text(/a[)]b/)`. In a regexp literal, parentheses inside a
    // character class are literal characters, not function parentheses, so they must not change the balance:
    // `:has-text(/a[)]b/)` must not close `:has-text()` on the `)` inside `[)]`.
    // The state is only enabled if the argument starts with a solidus, i.e. it looks like a regexp literal. Thus
    // plain-text arguments with square brackets, e.g. `:has-text([Anzeige])`, keep the previous behavior.
    let regexpState: 'none' | 'opening' | 'body' | 'class' | 'done' = context.code === CodePoint.Solidus
        ? 'opening'
        : 'none';

    // Whether the previous code point was an escaping reverse solidus
    let escaped = false;

    // Consume until we find the closing parenthesis or we reach the end of the source
    while (!context.isEof()) {
        // Update the regexp literal state
        switch (regexpState) {
            case 'opening':
                // The current code point is the opening solidus of the literal
                regexpState = 'body';
                break;
            case 'body':
                if (escaped) {
                    escaped = false;
                } else if (context.code === CodePoint.ReverseSolidus) {
                    escaped = true;
                } else if (context.code === CodePoint.LeftSquareBracket) {
                    regexpState = 'class';
                } else if (context.code === CodePoint.Solidus) {
                    // The current code point is the closing solidus of the literal
                    regexpState = 'done';
                }
                break;
            case 'class':
                if (escaped) {
                    escaped = false;
                } else if (context.code === CodePoint.ReverseSolidus) {
                    escaped = true;
                } else if (context.code === CodePoint.RightSquareBracket) {
                    regexpState = 'body';
                }
                break;
            default:
                break;
        }

        // Parentheses inside a regexp character class are literal characters
        if (regexpState !== 'class') {
            if (context.code === CodePoint.LeftParenthesis && context.prevCode !== CodePoint.ReverseSolidus) {
                // If we find an unescaped opening parenthesis, we increase the balance
                balance += 1;
            } else if (context.code === CodePoint.RightParenthesis && context.prevCode !== CodePoint.ReverseSolidus) {
                // If we find an unescaped closing parenthesis, we decrease the balance
                balance -= 1;

                // If the balance is 0, it means that we found the closing parenthesis
                if (balance === 0) {
                    break;
                }
            }
        }

        // Consume the current character as a delim-token
        context.consumeTrivialToken(TokenType.Delim);
    }
};
