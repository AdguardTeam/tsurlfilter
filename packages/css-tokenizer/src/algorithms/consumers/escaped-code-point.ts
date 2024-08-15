/**
 * @file Tokenizing logic for escaped code points
 */

import { type TokenizerContextFunction } from '../../common/types/function-prototypes';
import { type TokenizerContext } from '../../common/context';
import { isHexDigit } from '../definitions';
import { ErrorMessage } from '../../common/enums/error-messages';

export const MAX_HEX_DIGITS = 6;

/**
 * § 4.3.7. Consume an escaped code point
 *
 * @param context Reference to the tokenizer context instance
 * @see {@link https://www.w3.org/TR/css-syntax-3/#consume-escaped-code-point}
 */
export const consumeEscapedCodePoint: TokenizerContextFunction = (context: TokenizerContext): void => {
    // It assumes that the U+005C REVERSE SOLIDUS (\) has already been consumed and that the next input code point has
    // already been verified to be part of a valid escape.

    // Consume the next input code point.
    context.consumeCodePoint();

    // hex digit
    if (isHexDigit(context.code)) {
        // Consume as many hex digits as possible, but no more than 5. Note that this means 1-6 hex digits have been
        // consumed in total. If the next input code point is whitespace, consume it as well. Interpret the hex digits
        // as a hexadecimal number.
        let consumedHexDigits = 0;

        while (isHexDigit(context.code) && consumedHexDigits <= MAX_HEX_DIGITS) {
            context.consumeCodePoint();
            consumedHexDigits += 1;
        }

        // If the next input code point is whitespace, consume it as well.
        context.consumeSingleWhitespace();

        // If this number is zero, or is for a surrogate, or is greater than the maximum allowed code point,
        // return U+FFFD REPLACEMENT CHARACTER (�).
        // Otherwise, return the code point with that value.
        // TODO: Implement surrogate check
    }

    // EOF
    // This is a parse error. Return U+FFFD REPLACEMENT CHARACTER (�).
    if (context.isEof()) {
        context.onError(ErrorMessage.UnexpectedEofInEscaped, context.offset, context.offset);
    }

    // anything else
    // Return the current input code point.
};
