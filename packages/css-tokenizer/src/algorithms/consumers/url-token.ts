/**
 * @file Tokenizing logic for URLs
 */

import { type TokenizerContextFunction } from '../../common/types/function-prototypes';
import { checkForValidEscape, isNonPrintableCodePoint, isWhitespace } from '../definitions';
import { consumeEscapedCodePoint } from './escaped-code-point';
import { type TokenizerContext } from '../../common/context';
import { CodePoint } from '../../common/enums/code-points';
import { TokenType } from '../../common/enums/token-types';
import { ErrorMessage } from '../../common/enums/error-messages';

/**
 * § 4.3.14. Consume the remnants of a bad url
 *
 * Consume the remnants of a bad url from a stream of code points, "cleaning up" after the tokenizer realizes that it’s
 * in the middle of a <bad-url-token> rather than a <url-token>. It returns nothing; its sole use is to consume enough
 * of the input stream to reach a recovery point where normal tokenizing can resume.
 *
 * @param context Tokenizer context
 * @see {@link https://www.w3.org/TR/css-syntax-3/#consume-remnants-of-bad-url}
 */
function consumeBadUrlRemnants(context: TokenizerContext): void {
    // Repeatedly consume the next input code point from the stream:
    // eslint-disable-next-line no-constant-condition
    for (; !context.isEof(); context.consumeCodePoint()) {
        // U+0029 RIGHT PARENTHESIS ())
        if (context.code === CodePoint.RightParenthesis) {
            // Don’t forget to consume it.
            context.consumeCodePoint();
            return;
        }

        // the input stream starts with a valid escape
        if (checkForValidEscape(context.getRelativeCode(1), context.getRelativeCode(2))) {
            // Consume an escaped code point. This allows an escaped right parenthesis ("\)") to be encountered
            // without ending the <bad-url-token>. This is otherwise identical to the "anything else" clause.
            context.consumeCodePoint();
            consumeEscapedCodePoint(context);
            continue;
        }

        // anything else
        // Do nothing.
    }
}

/**
 * Helper function for consuming a bad url token.
 *
 * @param context Tokenizer context
 * @param start Token start offset
 * @see {@link https://www.w3.org/TR/css-syntax-3/#consume-remnants-of-bad-url}
 */
function consumeBadUrlToken(context: TokenizerContext, start: number): void {
    consumeBadUrlRemnants(context);
    context.onToken(TokenType.BadUrl, start, context.offset, undefined, context.stop);
}

/**
 * § 4.3.6. Consume a url token
 *
 * Consume a url token from a stream of code points. It returns either a <url-token> or a <bad-url-token>.
 *
 * @param context Reference to the tokenizer context instance
 * @param start Token start offset
 * @see {@link https://www.w3.org/TR/css-syntax-3/#consume-url-token}
 * @note This algorithm assumes that the initial "url(" has already been consumed. This algorithm also assumes that
 * it’s being called to consume an "unquoted" value, like url(foo). A quoted value, like url("foo"), is parsed as a
 * <function-token>. Consume an ident-like token automatically handles this distinction; this algorithm shouldn’t be
 * called directly otherwise.
 */
export const consumeUrlToken: TokenizerContextFunction = (context: TokenizerContext, start: number): void => {
    // Initially create a <url-token> with its value set to the empty string.

    // Consume as much whitespace as possible.
    while (isWhitespace(context.code)) {
        context.consumeCodePoint();
    }

    // Repeatedly consume the next input code point from the stream:
    // eslint-disable-next-line no-constant-condition
    while (context.offset <= context.length) {
        // TODO: Use switch-case here, but need to resolve non-printable code points first
        // U+0029 RIGHT PARENTHESIS ())
        if (context.code === CodePoint.RightParenthesis) {
            // Consume it.
            context.consumeCodePoint();

            // Return the <url-token>.
            context.onToken(TokenType.Url, start, context.offset, undefined, context.stop);
            return;
        }

        // EOF
        if (context.isEof()) {
            // This is a parse error. Return the <url-token>.
            context.onToken(TokenType.Url, start, context.offset, undefined, context.stop);
            context.onError(ErrorMessage.UnexpectedEofInUrl, start, context.offset);
            return;
        }

        // whitespace
        if (isWhitespace(context.code)) {
            // Consume as much whitespace as possible. If the next input code point is U+0029 RIGHT PARENTHESIS ())
            // or EOF, consume it and return the <url-token> (if EOF was encountered, this is a parse error);
            // otherwise, consume the remnants of a bad url, create a <bad-url-token>, and return it.
            while (isWhitespace(context.code)) {
                context.consumeCodePoint();
            }

            if (context.code === CodePoint.RightParenthesis || context.isEof()) {
                context.consumeCodePoint();
                context.onToken(TokenType.Url, start, context.offset, undefined, context.stop);
                context.onError(ErrorMessage.UnexpectedEofInUrl, start, context.offset);
                return;
            }

            context.onError(ErrorMessage.UnexpectedCharInUrl, start, context.offset);
            consumeBadUrlToken(context, start);
            return;
        }

        // U+0022 QUOTATION MARK (")
        // U+0027 APOSTROPHE (')
        // U+0028 LEFT PARENTHESIS (()
        // non-printable code point
        if (
            context.code === CodePoint.QuotationMark
            || context.code === CodePoint.Apostrophe
            || context.code === CodePoint.LeftParenthesis
            || isNonPrintableCodePoint(context.code)
        ) {
            // This is a parse error. Consume the remnants of a bad url, create a <bad-url-token>, and return it.
            context.onError(ErrorMessage.UnexpectedCharInUrl, start, context.offset);
            consumeBadUrlToken(context, start);
            return;
        }

        // U+005C REVERSE SOLIDUS (\)
        if (context.code === CodePoint.ReverseSolidus) {
            // If the stream starts with a valid escape, consume an escaped code point and append the returned code
            // point to the <url-token>’s value.
            if (checkForValidEscape(context.code, context.nextCode)) {
                // Consume reversed solidus, then consume escaped code point
                context.consumeCodePoint();
                consumeEscapedCodePoint(context);
                continue;
            }

            // Otherwise, this is a parse error. Consume the remnants of a bad url, create a <bad-url-token>, and
            // return it.
            context.onError(ErrorMessage.UnexpectedCharInUrl, start, context.offset);
            consumeBadUrlToken(context, start);
            return;
        }

        // anything else
        // Append the current input code point to the <url-token>’s value.
        context.consumeCodePoint();
    }
};
