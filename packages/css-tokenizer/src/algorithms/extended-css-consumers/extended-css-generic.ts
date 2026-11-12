/**
 * @file Custom tokenizing logic for Extended CSS's pseudo-classes
 */

import { type TokenizerContext } from '../../common/context';
import { CodePoint } from '../../common/enums/code-points';
import { TokenType } from '../../common/enums/token-types';
import { type TokenizerContextFunction } from '../../common/types/function-prototypes';
import { isWhitespace } from '../definitions';

/**
 * Marks the code points that are inside regexp character classes of a raw extended CSS pseudo-class argument.
 *
 * A regexp literal may be the whole argument, e.g. `:has-text(/a[)]b/)`, or the value of a `property: value`
 * argument, e.g. `:matches-css(background-image: /^url\([)]/)`. A solidus opens a literal only at these positions,
 * only outside quoted text, and only when an unescaped closing solidus follows. Thus plain-text arguments keep the
 * previous behavior: this covers arguments with square brackets, e.g. `:has-text([Anzeige])`, and arguments that
 * start with a solidus without a closing one, e.g. `:has-text(/foo[bar)`.
 *
 * Parentheses inside a marked character class are literal characters, so they must not change the parenthesis
 * balance of the pseudo-class argument.
 *
 * @param context Reference to the tokenizer context instance, positioned at the start of the argument.
 *
 * @returns Flags where a nonzero value marks a code point that is inside a regexp character class.
 */
const markRegexpCharClasses = (context: TokenizerContext): Uint8Array => {
    const argumentLength = context.length - context.offset;
    const flags = new Uint8Array(argumentLength);

    let index = 0;
    let quote: number | null = null;
    let escaped = false;

    while (index < argumentLength) {
        const code = context.getRelativeCode(index);

        // Skip an escaped code point
        if (escaped) {
            escaped = false;
            index += 1;
            continue;
        }

        if (code === CodePoint.ReverseSolidus) {
            escaped = true;
            index += 1;
            continue;
        }

        // Skip quoted text, where a colon does not start a `property: value` argument
        if (quote !== null) {
            if (code === quote) {
                quote = null;
            }
            index += 1;
            continue;
        }

        if (code === CodePoint.Apostrophe || code === CodePoint.QuotationMark) {
            quote = code;
            index += 1;
            continue;
        }

        if (code !== CodePoint.Solidus) {
            index += 1;
            continue;
        }

        // A regexp literal is either the whole argument or the value after a colon,
        // e.g. `:matches-css(background-image: /^url\(/)`
        let previousIndex = index - 1;
        while (previousIndex >= 0 && isWhitespace(context.getRelativeCode(previousIndex) ?? 0)) {
            previousIndex -= 1;
        }

        if (index !== 0 && context.getRelativeCode(previousIndex) !== CodePoint.Colon) {
            index += 1;
            continue;
        }

        // Find the unescaped closing solidus of the literal
        let closingIndex = index + 1;
        let literalEscaped = false;
        let inClass = false;
        while (closingIndex < argumentLength) {
            const literalCode = context.getRelativeCode(closingIndex);

            if (literalEscaped) {
                literalEscaped = false;
            } else if (literalCode === CodePoint.ReverseSolidus) {
                literalEscaped = true;
            } else if (inClass) {
                if (literalCode === CodePoint.RightSquareBracket) {
                    inClass = false;
                }
            } else if (literalCode === CodePoint.LeftSquareBracket) {
                inClass = true;
            } else if (literalCode === CodePoint.Solidus) {
                break;
            }

            closingIndex += 1;
        }

        // The solidus does not open a complete regexp literal, so treat it as plain text
        if (closingIndex >= argumentLength) {
            index += 1;
            continue;
        }

        // Mark the character class interiors of the literal
        let classEscaped = false;
        let classOpen = false;
        for (let i = index + 1; i < closingIndex; i += 1) {
            const literalCode = context.getRelativeCode(i);

            if (classEscaped) {
                classEscaped = false;
            } else if (literalCode === CodePoint.ReverseSolidus) {
                classEscaped = true;
            } else if (classOpen) {
                flags[i] = 1;

                if (literalCode === CodePoint.RightSquareBracket) {
                    classOpen = false;
                }
            } else if (literalCode === CodePoint.LeftSquareBracket) {
                classOpen = true;
                flags[i] = 1;
            }
        }

        index = closingIndex + 1;
    }

    return flags;
};

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

    // Parentheses inside a regexp character class are literal characters, so they must not change the balance.
    // The flags are aligned with the argument code points, and the argument starts at the current offset.
    const regexpCharClassFlags = markRegexpCharClasses(context);
    let argumentIndex = 0;

    // Consume until we find the closing parenthesis or we reach the end of the source
    while (!context.isEof()) {
        if (regexpCharClassFlags[argumentIndex] === 0) {
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
        argumentIndex += 1;
    }
};
