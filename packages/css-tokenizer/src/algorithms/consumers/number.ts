/**
 * @file Tokenizing logic for numbers
 */

import { type TokenizerContextFunction } from '../../common/types/function-prototypes';
import { isDigit } from '../definitions';
import { type TokenizerContext } from '../../common/context';
import { CodePoint } from '../../common/enums/code-points';

/**
 * § 4.3.12. Consume a number
 *
 * Consume a number from a stream of code points. It returns a numeric value, and a type which is either "integer" or
 * "number".
 *
 * @see {@link https://www.w3.org/TR/css-syntax-3/#consume-number}
 *
 * @param context Reference to the tokenizer context instance
 *
 * @note This algorithm does not do the verification of the first few code points that are necessary to ensure a number
 * can be obtained from the stream. Ensure that the stream starts with a number before calling this algorithm.
 * @todo Uncomment type/repr handling if needed - currently we don't need them, and they're not used for performance
 * reasons
 */
export const consumeNumber: TokenizerContextFunction = (context: TokenizerContext): void /* [number, NumberType] */ => {
    // Execute the following steps in order:

    // 1. Initially set type to "integer". Let repr be the empty string.
    // TODO: Uncomment type/repr handling if needed
    // let type = NumberType.Integer;
    // const repr: string[] = [];

    // 2. If the next input code point is U+002B PLUS SIGN (+) or U+002D HYPHEN-MINUS (-), consume it and append it
    // to repr.
    if (context.code === CodePoint.PlusSign || context.code === CodePoint.HyphenMinus) {
        context.consumeCodePoint();
        // TODO: Append to repr
    }

    // 3. While the next input code point is a digit, consume it and append it to repr.
    while (isDigit(context.code)) {
        context.consumeCodePoint();
        // TODO: Append to repr
    }

    // 4. If the next 2 input code points are U+002E FULL STOP (.) followed by a digit, then:
    if (context.code === CodePoint.FullStop && isDigit(context.nextCode)) {
        // 1. Consume them.
        context.consumeCodePoint(2);

        // 2.Append them to repr
        // TODO: Append to repr

        // 3. Set type to "number".
        // type = NumberType.Number;

        // 4. While the next input code point is a digit, consume it and append it to repr.
        while (isDigit(context.code)) {
            context.consumeCodePoint();
            // TODO: Append to repr
        }
    }

    // 5. If the next 2 or 3 input code points are U+0045 LATIN CAPITAL LETTER E (E) or U+0065 LATIN SMALL LETTER E
    // (e) ...
    if ((context.code === CodePoint.LatinCapitalLetterE || context.code === CodePoint.LatinSmallLetterE)) {
        // ... optionally followed by U+002D HYPHEN-MINUS (-) or U+002B PLUS SIGN (+)
        // Note: we split this into two if statements to avoid declaring a shift variable for the sign
        if (
            (context.nextCode === CodePoint.HyphenMinus || context.nextCode === CodePoint.PlusSign)
            && isDigit(context.getRelativeCode(2))
        ) {
            // 1. Consume them.
            context.consumeCodePoint(3); // e, sign, digit

            // 2. Append them to repr.
            // TODO: Append to repr

            // 3. Set type to "number".
            // TODO: Set type

            // 4. While the next input code point is a digit, consume it and append it to repr.
            while (isDigit(context.code)) {
                context.consumeCodePoint();
                // TODO: Append to repr
            }
        } else if (isDigit(context.nextCode)) {
            // ... followed by a digit, then:
            // 1. Consume them.
            context.consumeCodePoint(2); // e, digit

            // 2. Append them to repr.
            // TODO: Append to repr

            // 3. Set type to "number".
            // TODO: Set type

            // 4. While the next input code point is a digit, consume it and append it to repr.
            while (isDigit(context.code)) {
                context.consumeCodePoint();
                // TODO: Append to repr
            }
        }
    }

    // 6. Convert repr to a number, and set the value to the returned value.
    // TODO: Convert repr to a number
    // const value = Number(repr.join(''));

    // 7. Return value and type.
    // TODO: Uncomment type handling if needed
    // return [value, type];
};
