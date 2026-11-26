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
 * A character class that has no closing square bracket in the scanned range makes the
 * literal incomplete, so the scan stops as soon as such a class opens instead of
 * scanning the rest of the source.
 *
 * @param context Reference to the tokenizer context instance.
 * @param start Index of the opening solidus relative to the argument start.
 * @param limit End of the source range to scan, relative to the argument start.
 * @param lastRightSquareBracket Index of the last right square bracket in the scanned
 * range, relative to the argument start, or `-1` if the range has none.
 *
 * @returns Index of the closing solidus relative to the argument start, or `-1` if the
 * solidus does not open a complete regexp literal.
 */
const findRegexpLiteralEnd = (
    context: TokenizerContext,
    start: number,
    limit: number,
    lastRightSquareBracket: number,
): number => {
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
            // A class without a closing bracket cannot end before the limit, so the
            // literal is incomplete. Stop instead of scanning the rest of the source.
            if (lastRightSquareBracket <= index) {
                return -1;
            }

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
 * Checks whether the quote at the given index opens a quoted value.
 *
 * A quoted value follows a colon, a comma or an equals sign, as in
 * `:matches-css(a: "x)y", b: 'z)')` or `:matches-attr(data-x="a)b")`. A quote in plain
 * text, e.g. in `:contains(it's)`, does not open a quoted value, so it must not hide the
 * parenthesis that closes the argument.
 *
 * @param context Reference to the tokenizer context instance.
 * @param index Index of the quote relative to the argument start.
 *
 * @returns `true` if the quote opens a quoted value, `false` otherwise.
 */
const isQuotedValueStart = (context: TokenizerContext, index: number): boolean => {
    let previousIndex = index - 1;
    while (previousIndex >= 0 && isWhitespace(context.getRelativeCode(previousIndex) ?? 0)) {
        previousIndex -= 1;
    }

    const previous = context.getRelativeCode(previousIndex);

    return previous === CodePoint.Colon
        || previous === CodePoint.Comma
        || previous === CodePoint.EqualsSign;
};

/**
 * Finds the closing quote of a quoted value.
 *
 * Escapes are read in pairs, so a quote preceded by an odd number of reverse solidi is
 * plain text. The quote ends the value only when the rest of the argument follows it,
 * i.e. whitespace, a comma, a semicolon or the closing parenthesis. Otherwise it is more
 * likely an opening quote of a value in a following pseudo-class, e.g. in
 * `div:contains(/a:"b/), span:contains("c")` the first quote must not pair with the
 * quote in `span:contains("c")`.
 *
 * @param context Reference to the tokenizer context instance.
 * @param start Index of the opening quote relative to the argument start.
 * @param limit End of the source range to scan, relative to the argument start.
 *
 * @returns Index of the closing quote relative to the argument start, or `-1` if the
 * quote does not open a quoted value that ends inside the argument.
 */
const findQuoteEnd = (context: TokenizerContext, start: number, limit: number): number => {
    const quote = context.getRelativeCode(start);
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

        if (code === quote) {
            const next = index + 1 < limit ? context.getRelativeCode(index + 1) : undefined;

            if (next === undefined
                || next === CodePoint.Comma
                || next === CodePoint.SemiColon
                || next === CodePoint.RightParenthesis
                || isWhitespace(next)) {
                return index;
            }

            // The quote opens another quoted value, so this one has no closing quote
            // inside the argument.
            return -1;
        }
    }

    return -1;
};

/**
 * Finds the closing parenthesis of the pseudo-class argument after a regexp literal.
 *
 * The literal may be followed by more text of the same argument, e.g.
 * `:has-text(/a[)]b/ + a)`, so the search continues from the literal end and returns
 * the first unescaped parenthesis that closes the argument. A parenthesis inside a
 * quoted value, e.g. the one in the `e: "f)g"` part of
 * `:matches-css(a: /c[)]d/, e: "f)g")`, does not close the argument. If the rest of the
 * source has no such parenthesis, the literal is not a part of the argument, e.g.
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

        // Skip a quoted value, where a right parenthesis is plain text
        if ((code === CodePoint.Apostrophe || code === CodePoint.QuotationMark)
            && isQuotedValueStart(context, index)) {
            const quoteEnd = findQuoteEnd(context, index, length);

            if (quoteEnd >= 0) {
                index = quoteEnd;
                continue;
            }
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
 * argument follows the literal. A parenthesis inside a quoted value, e.g.
 * `:matches-css(a: "x)y", b: /c/)`, does not close the argument either. When the
 * class-blind scan finds no closing parenthesis at all, a complete literal followed
 * by one is used instead. Otherwise the argument keeps its class-blind end, so a later
 * part of the selector cannot turn a plain-text argument into a regexp.
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

    // The index of the last right square bracket, used to stop a regexp literal scan at
    // a class that never closes instead of scanning the rest of the source.
    let lastRightSquareBracket = -1;

    for (let index = length - 1; index >= 0; index -= 1) {
        if (context.getRelativeCode(index) === CodePoint.RightSquareBracket) {
            lastRightSquareBracket = index;
            break;
        }
    }

    // Find the first right parenthesis that closes the argument when character classes
    // are not taken into account. This is the previous behavior, used as a fallback. A
    // quoted value is skipped, but only when its closing quote is followed by the rest
    // of the argument, so a quote cannot hide a parenthesis of a following pseudo-class.
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

        // Skip a quoted value, where a right parenthesis is plain text
        if ((code === CodePoint.Apostrophe || code === CodePoint.QuotationMark)
            && isQuotedValueStart(context, index)) {
            const quoteEnd = findQuoteEnd(context, index, length);

            if (quoteEnd >= 0) {
                index = quoteEnd;
                continue;
            }
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
    //
    // The search stops at the candidate, because only a literal that starts inside the
    // argument can change its end. A literal of a following pseudo-class starts after
    // the candidate and must not extend this argument. This bound also keeps the scan
    // proportional to the length of the argument instead of the rest of the selector.
    const hasCandidate = candidate < length;
    const scanLimit = candidate;
    let index = 0;
    let quote: number | null = null;
    escaped = false;

    while (index < scanLimit) {
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

        const literalEnd = findRegexpLiteralEnd(context, index, length, lastRightSquareBracket);

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
