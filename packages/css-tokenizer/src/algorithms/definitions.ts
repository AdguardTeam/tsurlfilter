/**
 * @file Implementation of CSS Syntax Module Level 3 tokenizer definitions (§ 4.2.)
 *
 * @see {@link https://www.w3.org/TR/css-syntax-3/#tokenizer-definitions}
 */

import { CodePoint } from '../common/enums/code-points';

/**
 * Check if code point code is between two code points
 *
 * @param code Code point to check
 * @param min Minimum code point
 * @param max Maximum code point
 * @returns `true` if code point is between `min` and `max`, `false` otherwise
 * @note Boundaries are inclusive
 * @note This function is used instead of `code >= min && code <= max` because TypeScript doesn't allow to compare
 * `number | undefined` with `number` (even though it's perfectly valid in JavaScript)
 */
function isBetween(code: number | undefined, min: number, max: number): boolean {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore 18048
    return code >= min && code <= max;
}

/**
 * Check if code point code is greater than other code point
 *
 * @param code Code point to check
 * @param min Minimum code point
 * @returns `true` if code point is greater than `min`, `false` otherwise
 * @note This function is used instead of `code > min` because TypeScript doesn't allow to compare
 * `number | undefined` with `number` (even though it's perfectly valid in JavaScript)
 */
function isGreaterThan(code: number | undefined, min: number): boolean {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore 18048
    return code > min;
}

/**
 * Check if code point code is greater than or equal to other code point
 *
 * @param code Code point to check
 * @param min Minimum code point
 * @returns `true` if code point is greater than or equal to `min`, `false` otherwise
 * @note This function is used instead of `code >= min` because TypeScript doesn't allow to compare
 * `number | undefined` with `number` (even though it's perfectly valid in JavaScript)
 */
function isGreaterThanOrEqual(code: number | undefined, min: number): boolean {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore 18048
    return code >= min;
}

/**
 * Check if character code is a digit
 *
 * @param code Character code
 * @returns `true` if character code is a digit, `false` otherwise
 * @see {@link https://www.w3.org/TR/css-syntax-3/#digit}
 */
export function isDigit(code: number | undefined): boolean {
    // A code point between U+0030 DIGIT ZERO (0) and U+0039 DIGIT NINE (9) inclusive.
    return isBetween(code, CodePoint.DigitZero, CodePoint.DigitNine);
}

/**
 * Check if character code is a hex digit
 *
 * @param code Character code
 * @returns `true` if character code is a hex digit, `false` otherwise
 * @see {@link https://www.w3.org/TR/css-syntax-3/#hex-digit}
 */
export function isHexDigit(code: number | undefined): boolean {
    // A digit, or a code point between U+0041 LATIN CAPITAL LETTER A (A) and U+0046 LATIN CAPITAL LETTER F (F)
    // inclusive, or a code point between U+0061 LATIN SMALL LETTER A (a) and U+0066 LATIN SMALL LETTER F (f) inclusive.
    return isDigit(code) // 0-9
        || isBetween(code, CodePoint.LatinCapitalLetterA, CodePoint.LatinCapitalLetterF) // A-F
        || isBetween(code, CodePoint.LatinSmallLetterA, CodePoint.LatinSmallLetterF); // a-f
}

/**
 * Check if character code is an uppercase letter
 *
 * @param code Character code
 * @returns `true` if character code is an uppercase letter, `false` otherwise
 * @see {@link https://www.w3.org/TR/css-syntax-3/#uppercase-letter}
 */
export function isUppercaseLetter(code: number | undefined): boolean {
    // A code point between U+0041 LATIN CAPITAL LETTER A (A) and U+005A LATIN CAPITAL LETTER Z (Z) inclusive.
    return isBetween(code, CodePoint.LatinCapitalLetterA, CodePoint.LatinCapitalLetterZ); // A-Z
}

/**
 * Check if character code is a lowercase letter
 *
 * @param code Character code
 * @returns `true` if character code is a lowercase letter, `false` otherwise
 * @see {@link https://www.w3.org/TR/css-syntax-3/#lowercase-letter}
 */
export function isLowercaseLetter(code: number | undefined): boolean {
    // A code point between U+0061 LATIN SMALL LETTER A (a) and U+007A LATIN SMALL LETTER Z (z) inclusive.
    return isBetween(code, CodePoint.LatinSmallLetterA, CodePoint.LatinSmallLetterZ); // a-z
}

/**
 * Check if character code is a letter
 *
 * @param code Character code
 * @returns `true` if character code is a letter, `false` otherwise
 * @see {@link https://www.w3.org/TR/css-syntax-3/#letter}
 */
export function isLetter(code: number | undefined): boolean {
    // An uppercase letter or a lowercase letter.
    return isUppercaseLetter(code) || isLowercaseLetter(code); // A-Z or a-z
}

/**
 * Check if character code is a non-ASCII code point
 *
 * @param code Character code
 * @returns `true` if character code is a non-ASCII code point, `false` otherwise
 * @see {@link https://www.w3.org/TR/css-syntax-3/#non-ascii-code-point}
 */
export function isNonAsciiCodePoint(code: number | undefined): boolean {
    // A code point with a value equal to or greater than U+0080 <control>.
    return isGreaterThanOrEqual(code, CodePoint.ControlCharacterStart);
}

/**
 * Check if character code is a name code point
 *
 * @param code Character code
 * @returns `true` if character code is a name start code point, `false` otherwise
 * @see {@link https://www.w3.org/TR/css-syntax-3/#ident-start-code-point}
 */
export function isIdentStartCodePoint(code: number | undefined): boolean {
    // A letter, a non-ASCII code point, or U+005F LOW LINE (_).
    return isLetter(code) || isNonAsciiCodePoint(code) || code === CodePoint.LowLine;
}

/**
 * Check if character code is a name code point
 *
 * @param code Character code
 * @returns `true` if character code is a name code point, `false` otherwise
 * @see {@link https://www.w3.org/TR/css-syntax-3/#ident-code-point}
 */
export function isIdentCodePoint(code: number | undefined): boolean {
    // An ident-start code point, a digit, or U+002D HYPHEN-MINUS (-).
    return isIdentStartCodePoint(code) || isDigit(code) || code === CodePoint.HyphenMinus;
}

/**
 * Check if character code is a non-printable code point
 *
 * @param code Character code
 * @returns `true` if character code is a non-printable code point, `false` otherwise
 * @see {@link https://www.w3.org/TR/css-syntax-3/#non-printable-code-point}
 */
export function isNonPrintableCodePoint(code: number | undefined): boolean {
    // A code point between U+0000 NULL and U+0008 BACKSPACE inclusive, or U+000B LINE TABULATION, or a code point
    // between U+000E SHIFT OUT and U+001F INFORMATION SEPARATOR ONE inclusive, or U+007F DELETE.
    return isBetween(code, CodePoint.Null, CodePoint.Backspace)
        || code === CodePoint.LineTabulation
        || isBetween(code, CodePoint.ShiftOut, CodePoint.InformationSeparatorOne)
        || code === CodePoint.Delete;
}

/**
 * Check if character code is a newline
 *
 * @param code Character code
 * @returns `true` if character code is a newline, `false` otherwise
 * @see {@link https://www.w3.org/TR/css-syntax-3/#newline}
 */
export function isNewline(code: number | undefined): boolean {
    // U+000A LINE FEED. Note that U+000D CARRIAGE RETURN and U+000C FORM FEED are not included in this definition, as
    // they are converted to U+000A LINE FEED during preprocessing.
    return code === CodePoint.LineFeed || code === CodePoint.CarriageReturn || code === CodePoint.FormFeed;
}

/**
 * Check if character code is a whitespace
 *
 * @param code Character code
 * @returns `true` if character code is a whitespace, `false` otherwise
 * @see {@link https://www.w3.org/TR/css-syntax-3/#whitespace}
 */
export function isWhitespace(code: number | undefined): boolean {
    // A newline, U+0009 CHARACTER TABULATION, or U+0020 SPACE.
    return isNewline(code) || code === CodePoint.CharacterTabulation || code === CodePoint.Space;
}

/**
 * Check if character code is a leading surrogate
 *
 * @param code Character code
 * @returns `true` if character code is a leading surrogate, `false` otherwise
 * @see {@link https://infra.spec.whatwg.org/#surrogate}
 */
export function isLeadingSurrogate(code: number | undefined): boolean {
    return isBetween(code, CodePoint.LeadingSurrogateStart, CodePoint.LeadingSurrogateEnd);
}

/**
 * Check if character code is a trailing surrogate
 *
 * @param code Character code
 * @returns `true` if character code is a trailing surrogate, `false` otherwise
 * @see {@link https://infra.spec.whatwg.org/#surrogate}
 */
export function isTrailingSurrogate(code: number | undefined): boolean {
    return isBetween(code, CodePoint.TrailingSurrogateStart, CodePoint.TrailingSurrogateEnd);
}

/**
 * Check if character code is a surrogate
 *
 * @param code Character code
 * @returns `true` if character code is a surrogate, `false` otherwise
 * @see {@link https://infra.spec.whatwg.org/#surrogate}
 */
export function isSurrogate(code: number | undefined): boolean {
    return isLeadingSurrogate(code) || isTrailingSurrogate(code);
}

/**
 * Check if character code is greater than maximum allowed code point
 *
 * @param code Character code
 * @returns `true` if character code is greater than maximum allowed code point, `false` otherwise
 * @see {@link https://www.w3.org/TR/css-syntax-3/#maximum-allowed-code-point}
 */
export function isGreaterThanMaxAllowedCodePoint(code: number | undefined): boolean {
    return isGreaterThan(code, CodePoint.MaxCodePoint);
}

// TODO: Uncomment when needed, maybe useful in the future
// /**
//  * Check if character code is a valid identifier sequence code point
//  *
//  * @param code Character code
//  * @returns `true` if character code is a valid identifier sequence code point, `false` otherwise
//  * @see {@link https://www.w3.org/TR/css-syntax-3/#ident-sequence}
//  * @note The part of an <at-keyword-token> after the "@", the part of a <hash-token> (with the "id" type flag) after
//  * the "#", the part of a <function-token> before the "(", and the unit of a <dimension-token> are all ident
//  * sequences.
//  */
// export function isIdentSequence(code: number): boolean {
//     // A sequence of code points that has the same syntax as an <ident-token>.
// eslint-disable-next-line max-len
//     return isIdentStartCodePoint(code) || isDigit(code) || code === CodePoint.HyphenMinus || code === CodePoint.LowLine;
// }

/**
 * Check if character code is a BOM (Byte Order Mark)
 *
 * @param code Character code to check
 * @returns `true` if character code is a BOM, `false` otherwise
 */
export function isBOM(code: number | undefined): boolean {
    return code === CodePoint.Utf16BeBom || code === CodePoint.Utf16LeBom;
}

/**
 * § 4.3.8. Check if two code points are a valid escape
 *
 * @param a First code point
 * @param b Second code point
 * @returns `true` if the code points are a valid escape, `false` otherwise
 * @see {@link https://www.w3.org/TR/css-syntax-3/#starts-with-a-valid-escape}
 * @note This algorithm will not consume any additional code point.
 */
export const checkForValidEscape = (a: number | undefined, b: number | undefined): boolean => {
    // If the first code point is not U+005C REVERSE SOLIDUS (\), return false.
    if (a !== CodePoint.ReverseSolidus) {
        return false;
    }

    // Otherwise, if the second code point is a newline, return false.
    // Otherwise, return true.
    return !isNewline(b);
};

/**
 * § 4.3.9. Check if three code points would start an ident sequence
 *
 * @param a First code point
 * @param b Second code point
 * @param c Third code point
 * @returns `true` if the next code points would start an identifier, `false` otherwise
 * @see {@link https://www.w3.org/TR/css-syntax-3/#would-start-an-identifier}
 * @note This algorithm will not consume any additional code points.
 */
export const checkForIdentStart = (a: number | undefined, b: number | undefined, c: number | undefined): boolean => {
    // Look at the first code point:

    // U+002D HYPHEN-MINUS
    if (a === CodePoint.HyphenMinus) {
        // If the second code point is an ident-start code point or a U+002D HYPHEN-MINUS,
        // or the second and third code points are a valid escape, return true. Otherwise, return false.
        return isIdentStartCodePoint(b) || b === CodePoint.HyphenMinus || checkForValidEscape(b, c);
    }

    // ident-start code point
    if (isIdentStartCodePoint(a)) {
        // Return true.
        return true;
    }

    // U+005C REVERSE SOLIDUS (\)
    if (a === CodePoint.ReverseSolidus) {
        // If the first and second code points are a valid escape, return true. Otherwise, return false.
        return checkForValidEscape(a, b);
    }

    // anything else
    // Return false.
    return false;
};

/**
 * § 4.3.10. Check if three code points would start a number
 *
 * @param a First code point
 * @param b Second code point
 * @param c Third code point
 * @returns `true` if the next code points would start a number, `false` otherwise
 * @see {@link https://www.w3.org/TR/css-syntax-3/#starts-with-a-number}
 * @note This algorithm will not consume any additional code points.
 */
export const checkForNumberStart = (a: number | undefined, b: number | undefined, c: number | undefined): boolean => {
    // Look at the first code point:

    // U+002B PLUS SIGN (+)
    // U+002D HYPHEN-MINUS (-)
    if (a === CodePoint.PlusSign || a === CodePoint.HyphenMinus) {
        // If the second code point is a digit, return true.
        if (isDigit(b)) {
            return true;
        }

        // Otherwise, if the second code point is a U+002E FULL STOP (.) and the third code point is a digit, return
        // true.
        // Otherwise, return false.
        return b === CodePoint.FullStop && isDigit(c);
    }

    // U+002E FULL STOP (.)
    if (a === CodePoint.FullStop) {
        // If the second code point is a digit, return true. Otherwise, return false.
        return isDigit(b);
    }

    // digit
    // Return true.
    // anything else
    // Return false.
    return isDigit(a);
};
