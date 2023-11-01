/**
 * @file Tokenizing logic for strings
 */

import { type TokenizerContextFunction } from '../../common/types/function-prototypes';
import { checkForValidEscape, isNewline } from '../definitions';
import { consumeEscapedCodePoint } from './escaped-code-point';
import { type TokenizerContext } from '../../common/context';
import { TokenType } from '../../common/enums/token-types';
import { ErrorMessage } from '../../common/enums/error-messages';
import { CodePoint, ImaginaryCodePoint } from '../../common/enums/code-points';

/**
 * § 4.3.5. Consume a string token
 *
 * Consume a string token from a stream of code points. It returns either a <string-token> or <bad-string-token>.
 *
 * @param context Reference to the tokenizer context instance
 * @see {@link https://www.w3.org/TR/css-syntax-3/#consume-string-token}
 */
export const consumeStringToken: TokenizerContextFunction = (context: TokenizerContext): void => {
    // This algorithm may be called with an ending code point, which denotes the code point that ends the string.
    // If an ending code point is not specified, the current input code point is used.
    const endingCodePoint = context.code;

    // Initially create a <string-token> with its value set to the empty string.
    const start = context.offset;

    // Consume opening character
    context.consumeCodePoint();

    // Repeatedly consume the next input code point from the stream:
    // eslint-disable-next-line no-constant-condition
    while (context.isLessThanEqualToEof()) {
        switch (context.code) {
            // ending code point
            case endingCodePoint:
                // Consume it
                context.consumeCodePoint();

                // Return the <string-token>.
                context.onToken(TokenType.String, start, context.offset);
                return;

            // EOF
            case ImaginaryCodePoint.Eof:
                // This is a parse error. Return the <string-token>.
                context.onToken(TokenType.String, start, context.offset);
                context.onError(ErrorMessage.UnexpectedEofInString, start, context.offset);
                return;

            // newline
            case CodePoint.CarriageReturn:
            case CodePoint.LineFeed:
            case CodePoint.FormFeed:
                // Special case: CRLF is 2 code points
                if (context.code === CodePoint.CarriageReturn && context.nextCode === CodePoint.LineFeed) {
                    // Do an extra consume
                    context.consumeCodePoint(1);
                }

                context.consumeCodePoint(1);

                // This is a parse error. Reconsume the current input code point, create a <bad-string-token>, and
                // return it.
                context.onToken(TokenType.BadString, start, context.offset);
                context.onError(ErrorMessage.UnexpectedNewlineInString, start, context.offset);
                return;

            // U+005C REVERSE SOLIDUS (\)
            case CodePoint.ReverseSolidus:
                // If the next input code point is EOF, do nothing.
                if (context.isNextEof()) {
                    context.consumeCodePoint();
                    context.onToken(TokenType.String, start, context.offset);
                    context.onError(ErrorMessage.UnexpectedEofInString, start, context.offset);
                    return;
                }

                // Otherwise, if the next input code point is a newline, consume it.
                if (isNewline(context.nextCode)) {
                    context.consumeCodePoint(2);
                    break;
                }

                // Otherwise, (the stream starts with a valid escape) consume an escaped code point and append the
                // returned code point to the <string-token>’s value.
                if (checkForValidEscape(context.code, context.nextCode)) {
                    context.consumeCodePoint();
                    consumeEscapedCodePoint(context);
                }

                break;

            // anything else
            default:
                // Append the current input code point to the <string-token>’s value.
                context.consumeCodePoint();
        }
    }
};
