/**
 * @file CSS identifier decoder.
 */

import { MAX_HEX_DIGITS } from '../algorithms/consumers/escaped-code-point';
import {
    isGreaterThanMaxAllowedCodePoint,
    isHexDigit,
    isSurrogate,
    isWhitespace,
} from '../algorithms/definitions';
import { CodePoint } from '../common/enums/code-points';

const EMPTY_STRING = '';

/**
 * Decodes a CSS identifier according to the CSS Syntax Module Level 3 specification.
 *
 * @param ident CSS identifier to decode.
 * @returns Decoded CSS identifier.
 */
export const decodeIdent = (ident: string): string => {
    const decodedIdent: string[] = [];

    for (let i = 0; i < ident.length; i += 1) {
        const codePoint = ident.charCodeAt(i);

        // 4.3.7. Consume an escaped code point
        // https://www.w3.org/TR/css-syntax-3/#consume-an-escaped-code-point
        if (codePoint === CodePoint.ReverseSolidus) {
            // hex digit
            if (isHexDigit(ident.charCodeAt(i + 1))) {
                // Consume as many hex digits as possible, but no more than 5.
                // Note that this means 1-6 hex digits have been consumed in total.
                let n = 0;
                let j = 0; // consumed hex digits

                while (j < MAX_HEX_DIGITS && isHexDigit(ident.charCodeAt(i + j + 1))) {
                    // Interpret the hex digits as a hexadecimal number.
                    n = n * 16 + parseInt(ident[i + j + 1], 16);
                    j += 1;
                }

                decodedIdent.push(
                    // If this number is zero, or is for a surrogate, or is greater than the maximum allowed code
                    // point, return U+FFFD REPLACEMENT CHARACTER (�).
                    // Otherwise, return the code point with that value.
                    String.fromCodePoint(
                        n === 0 || isSurrogate(n) || isGreaterThanMaxAllowedCodePoint(n)
                            ? CodePoint.ReplacementCharacter
                            : n,
                    ),
                );

                i += j;

                // If the next input code point is whitespace, consume it as well.
                const nextCodePoint = ident.charCodeAt(i + 1);
                if (isWhitespace(nextCodePoint)) {
                    // Consume whitespace character
                    i += 1;

                    // Special case: consume +1 character if the sequence is CR LF
                    if (nextCodePoint === CodePoint.CarriageReturn && ident.charCodeAt(i + 1) === CodePoint.LineFeed) {
                        i += 1;
                    }
                }
            }

            // do nothing for EOF
        } else {
            // anything else
            // Return the current input code point.
            decodedIdent.push(ident[i]);
        }
    }

    return decodedIdent.join(EMPTY_STRING);
};
