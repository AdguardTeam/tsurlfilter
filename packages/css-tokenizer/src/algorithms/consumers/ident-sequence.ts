/**
 * @file Tokenizing logic for ident sequences
 */

import { type TokenizerContextFunction } from '../../common/types/function-prototypes';
import { checkForValidEscape, isIdentCodePoint } from '../definitions';
import { consumeEscapedCodePoint } from './escaped-code-point';
import { type TokenizerContext } from '../../common/context';

/**
 * § 4.3.11. Consume an ident sequence
 *
 * Consume an ident sequence from a stream of code points. It returns a string containing the largest name that can be
 * formed from adjacent code points in the stream, starting from the first.
 *
 * @see {@link https://www.w3.org/TR/css-syntax-3/#consume-name}
 *
 * @param context Reference to the tokenizer context instance
 *
 * @note This algorithm does not do the verification of the first few code points that are necessary to ensure the
 * returned code points would constitute an <ident-token>. If that is the intended use, ensure that the stream
 * starts with an ident sequence before calling this algorithm.
 */
export const consumeIndentSequence: TokenizerContextFunction = (context: TokenizerContext): void => {
    // Let result initially be an empty string.

    // Repeatedly consume the next input code point from the stream:
    while (!context.isEof()) {
        // ident code point
        if (isIdentCodePoint(context.code)) {
            // Append the code point to result.
            context.consumeCodePoint();
            continue;
        }

        // the stream starts with a valid escape
        if (checkForValidEscape(context.code, context.nextCode)) {
            // Consume an escaped code point. Append the returned code point to result.
            context.consumeCodePoint();
            consumeEscapedCodePoint(context);
            continue;
        }

        // anything else
        // Reconsume the current input code point. Return result.
        return;
    }
};
