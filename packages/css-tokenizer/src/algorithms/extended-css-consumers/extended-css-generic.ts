/**
 * @file Custom tokenizing logic for Extended CSS's pseudo-classes
 */

import { type TokenizerContext } from '../../common/context';
import { CodePoint } from '../../common/enums/code-points';
import { TokenType } from '../../common/enums/token-types';
import { type TokenizerContextFunction } from '../../common/types/function-prototypes';
import { isIdentCodePoint, isWhitespace } from '../definitions';

/**
 * Checks whether the opening parenthesis at the given index starts a pseudo-class
 * function, e.g. `:has-text(`.
 *
 * @param context Reference to the tokenizer context instance.
 * @param index Index of the opening parenthesis relative to the argument start.
 *
 * @returns `true` if the parenthesis follows a pseudo-class name, `false` otherwise.
 */
const isPseudoClassFunctionOpening = (context: TokenizerContext, index: number): boolean => {
    let nameIndex = index - 1;

    if (!isIdentCodePoint(context.getRelativeCode(nameIndex))) {
        return false;
    }

    while (nameIndex >= 0 && isIdentCodePoint(context.getRelativeCode(nameIndex))) {
        nameIndex -= 1;
    }

    return context.getRelativeCode(nameIndex) === CodePoint.Colon;
};

/**
 * Finds the closing solidus of a regexp literal, if the literal is complete and its
 * character classes are unambiguous.
 *
 * The scan starts right after the opening solidus and stops at the first unescaped
 * solidus outside a character class. Escapes are read in pairs, so a solidus or a
 * square bracket preceded by an odd number of reverse solidi is plain text. Parentheses
 * outside character classes must be balanced, as in a valid regexp; otherwise the
 * solidus is treated as plain text.
 *
 * A right parenthesis inside a character class is treated as literal text, unless the
 * rest of the class looks like the following selector. That is the case when, after the
 * parenthesis, an opening parenthesis starts a pseudo-class function, e.g.
 * `:has-text(/foo[bar):has-text(]/)`, or an opening square bracket has anything but the
 * parenthesis right before it, e.g. `:has-text(/foo[bar) + a[href="/x]y/"])`. In these
 * examples the `)` closes the pseudo-class, and the later brackets and the solidus must
 * not make the argument a regexp. A bracket that immediately follows the parenthesis,
 * as in `:has-text(/[)[]/)`, stays a part of the class.
 *
 * @param context Reference to the tokenizer context instance.
 * @param start Index of the opening solidus relative to the argument start.
 * @param limit End of the source range to scan, relative to the argument start. Callers
 * pass the rest of the source; the literal is used only when a parenthesis closing the
 * argument follows it.
 *
 * @returns Index of the closing solidus relative to the argument start, or `-1` if the
 * solidus does not open a complete regexp literal.
 */
const findRegexpLiteralEnd = (context: TokenizerContext, start: number, limit: number): number => {
    let inClass = false;
    let classHasParenthesis = false;
    let depth = 0;
    let escaped = false;

    for (let index = start + 1; index < limit; index += 1) {
        const code = context.getRelativeCode(index);

        if (escaped) {
            escaped = false;
            continue;
        }

        if (code === CodePoint.ReverseSolidus) {
            escaped = true;
            continue;
        }

        if (inClass) {
            if (code === CodePoint.RightSquareBracket) {
                inClass = false;
                classHasParenthesis = false;
            } else if (code === CodePoint.RightParenthesis) {
                classHasParenthesis = true;
            } else if (classHasParenthesis
                && ((code === CodePoint.LeftParenthesis && isPseudoClassFunctionOpening(context, index))
                    || (code === CodePoint.LeftSquareBracket
                        && context.getRelativeCode(index - 1) !== CodePoint.RightParenthesis))) {
                // The class spans what looks like the rest of the selector, so the
                // parenthesis in it is more likely the pseudo-class closing parenthesis.
                return -1;
            }

            continue;
        }

        if (code === CodePoint.LeftSquareBracket) {
            inClass = true;
            classHasParenthesis = false;
        } else if (code === CodePoint.LeftParenthesis) {
            depth += 1;
        } else if (code === CodePoint.RightParenthesis) {
            // An unbalanced parenthesis outside a class is not a valid regexp
            if (depth === 0) {
                return -1;
            }

            depth -= 1;
        } else if (code === CodePoint.Solidus) {
            return depth === 0 ? index : -1;
        }
    }

    return -1;
};

/**
 * Checks whether the solidus at the given index opens a regexp literal.
 *
 * A literal is either the whole argument, e.g. `:has-text(/a/)`, or the value of a
 * `property: value` argument, e.g. `:matches-css(background-image: /^url\(/)`. Any other
 * solidus is plain text, so arguments such as `:has-text(http://example.com/a)` keep
 * their previous behavior.
 *
 * @param context Reference to the tokenizer context instance.
 * @param index Index of the solidus relative to the argument start.
 *
 * @returns `true` if the solidus may open a regexp literal, `false` otherwise.
 */
const isRegexpLiteralStart = (context: TokenizerContext, index: number): boolean => {
    if (index === 0) {
        return true;
    }

    let previousIndex = index - 1;
    while (previousIndex >= 0 && isWhitespace(context.getRelativeCode(previousIndex) ?? 0)) {
        previousIndex -= 1;
    }

    return context.getRelativeCode(previousIndex) === CodePoint.Colon;
};

/**
 * Finds the closing parenthesis of the pseudo-class argument after a regexp literal.
 *
 * The literal may be followed by more text of the same argument, e.g.
 * `:has-text(/a[)]b/ + a)`, so the search continues from the literal end and returns
 * the first unescaped parenthesis that closes the argument. If the rest of the source
 * has no such parenthesis, the literal is not a part of the argument, e.g.
 * `:has-text(/a[)]b/ + a[href="/x]y/"]`.
 *
 * @param context Reference to the tokenizer context instance.
 * @param literalEnd Index of the closing solidus relative to the argument start.
 * @param length Length of the source after the argument start.
 *
 * @returns Index of the closing parenthesis relative to the argument start, or `-1` if
 * the parenthesis does not follow the literal.
 */
const findClosingParenAfterLiteral = (
    context: TokenizerContext,
    literalEnd: number,
    length: number,
): number => {
    let depth = 0;
    let escaped = false;

    for (let index = literalEnd + 1; index < length; index += 1) {
        const code = context.getRelativeCode(index);

        if (escaped) {
            escaped = false;
            continue;
        }

        if (code === CodePoint.ReverseSolidus) {
            escaped = true;
            continue;
        }

        if (code === CodePoint.LeftParenthesis) {
            depth += 1;
            continue;
        }

        if (code === CodePoint.RightParenthesis) {
            if (depth === 0) {
                return index;
            }

            depth -= 1;
        }
    }

    return -1;
};

/**
 * Finds the end of the raw argument of an Extended CSS pseudo-class.
 *
 * The argument ends at the first unescaped right parenthesis which closes it. A
 * parenthesis inside a regexp character class does not close the argument when a
 * complete literal spans that parenthesis and another parenthesis that closes the
 * argument follows the literal. When the class-blind scan finds no closing parenthesis
 * at all, a complete literal followed by one is used instead. Otherwise the argument
 * keeps its class-blind end, so a later part of the selector cannot turn a plain-text
 * argument into a regexp.
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

    // Find the first right parenthesis that closes the argument when character classes
    // are not taken into account. This is the previous behavior, used as a fallback.
    let depth = 0;
    let escaped = false;
    let candidate = length;

    for (let index = 0; index < length; index += 1) {
        const code = context.getRelativeCode(index);

        if (escaped) {
            escaped = false;
            continue;
        }

        if (code === CodePoint.ReverseSolidus) {
            escaped = true;
            continue;
        }

        if (code === CodePoint.LeftParenthesis) {
            depth += 1;
            continue;
        }

        if (code === CodePoint.RightParenthesis) {
            if (depth === 0) {
                candidate = index;
                break;
            }

            depth -= 1;
        }
    }

    // Look for a complete regexp literal that starts before the candidate and spans it,
    // i.e. the candidate is inside a character class of the literal. Only then the
    // argument may end after the literal, at the parenthesis that follows it. If there
    // is no candidate, the class-blind scan saw unbalanced parentheses, so a complete
    // literal followed by the closing parenthesis is used as well.
    const hasCandidate = candidate < length;
    let index = 0;
    let quote: number | null = null;
    escaped = false;

    while (index < length) {
        const code = context.getRelativeCode(index);

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

        if (code !== CodePoint.Solidus || !isRegexpLiteralStart(context, index)) {
            index += 1;
            continue;
        }

        const literalEnd = findRegexpLiteralEnd(context, index, length);

        if (literalEnd < 0) {
            index += 1;
            continue;
        }

        if (hasCandidate && literalEnd < candidate) {
            // The literal ends before the candidate, so it cannot change the argument end
            index = literalEnd + 1;
            continue;
        }

        const argumentEnd = findClosingParenAfterLiteral(context, literalEnd, length);

        if (argumentEnd >= 0) {
            return argumentEnd;
        }

        // The literal is not followed by the closing parenthesis, so it is not a part
        // of the argument, e.g. `:has-text(/foo[bar) + a[href="/x]y/"]`.
        break;
    }

    return candidate;
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

    // Don't forget to report already consumed whitespace chars as delim-tokens (if any)
    // Note: we handle the parameter characters as delim-tokens, this is why we don't need to report them here
    // as whitespace-tokens
    for (let i = start; i < context.offset; i += 1) {
        context.onToken(TokenType.Delim, i, i + 1, undefined, context.stop);
    }

    // Parentheses inside a regexp character class are literal characters, so they must
    // not close the pseudo-class. The argument end is found before consuming anything.
    const argumentLength = findArgumentEnd(context);

    // Consume the argument as delim-tokens, leaving the closing parenthesis to the
    // standard tokenizer
    for (let argumentIndex = 0; argumentIndex < argumentLength && !context.isEof(); argumentIndex += 1) {
        context.consumeTrivialToken(TokenType.Delim);
    }
};
