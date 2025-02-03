/**
 * @file Tokenizing logic for numeric tokens
 */

import { type TokenizerContextFunction } from '../../common/types/function-prototypes';
import { consumeIndentSequence } from './ident-sequence';
import { consumeNumber } from './number';
import { type TokenizerContext } from '../../common/context';
import { checkForIdentStart } from '../definitions';
import { TokenType } from '../../common/enums/token-types';
import { CodePoint } from '../../common/enums/code-points';

/**
 * § 4.3.3. Consume a numeric token
 *
 * Consume a numeric token from a stream of code points. It returns either a <number-token>, <percentage-token>, or
 * <dimension-token>.
 *
 * @param context Reference to the tokenizer context instance
 * @see {@link https://www.w3.org/TR/css-syntax-3/#consume-numeric-token}
 */
export const consumeNumericToken: TokenizerContextFunction = (context: TokenizerContext): void => {
    const start = context.offset;

    // Consume a number and let number be the result.
    consumeNumber(context);

    // If the next 3 input code points would start an ident sequence, then:
    if (checkForIdentStart(context.code, context.nextCode, context.getRelativeCode(2))) {
        // 1. Create a <dimension-token> with the same value and type flag as number, and a unit set initially to
        // the empty string.

        // 2. Consume an ident sequence. Set the <dimension-token>’s unit to the returned value.
        consumeIndentSequence(context);

        // 3. Return the <dimension-token>.
        context.onToken(TokenType.Dimension, start, context.offset, undefined, context.stop);
        return;
    }

    // Otherwise, if the next input code point is U+0025 PERCENTAGE SIGN (%), consume it. Create a
    // <percentage-token> with the same value as number, and return it.
    if (context.code === CodePoint.PercentageSign) {
        context.consumeCodePoint();
        context.onToken(TokenType.Percentage, start, context.offset, undefined, context.stop);
        return;
    }

    // Otherwise, create a <number-token> with the same value and type flag as number, and return it.
    context.onToken(TokenType.Number, start, context.offset, undefined, context.stop);
};
