/**
 * @file CSS tokenizer that strictly follows the CSS Syntax Module Level 3 specification
 *
 * @see {@link https://www.w3.org/TR/css-syntax-3/#tokenization}
 */

import { consumeIdentLikeToken } from './algorithms/consumers/ident-like-token';
import { consumeIndentSequence } from './algorithms/consumers/ident-sequence';
import { consumeNumericToken } from './algorithms/consumers/numeric-token';
import { consumeStringToken } from './algorithms/consumers/string-token';
import { consumeWhitespaceToken } from './algorithms/consumers/whitespace-token';
import {
    checkForIdentStart,
    checkForNumberStart,
    checkForValidEscape,
    isIdentCodePoint,
    isIdentStartCodePoint,
} from './algorithms/definitions';
import { TokenizerContext } from './common/context';
import { CodePoint } from './common/enums/code-points';
import { ErrorMessage } from './common/enums/error-messages';
import { TokenType } from './common/enums/token-types';
import {
    type OnErrorCallback,
    type OnTokenCallback,
    type TokenizerContextFunction,
} from './common/types/function-prototypes';

/**
 * CSS tokenizer function
 *
 * @param source Source code to tokenize
 * @param onToken Tokenizer callback which is called for each token found in source code
 * @param onError Error callback which is called when a parsing error is found (optional)
 * @param functionHandlers Custom function handlers (optional)
 */
export const tokenize = (
    source: string,
    onToken: OnTokenCallback,
    onError: OnErrorCallback = () => {},
    functionHandlers?: Map<number, TokenizerContextFunction>,
): void => {
    // Create tokenizer context
    const context = new TokenizerContext(source, onToken, onError, functionHandlers);

    // Repeatedly consume the next input code point from the stream:
    while (!context.isEof()) {
        switch (context.code) {
            // According to the spec, these are all whitespace code points:
            case CodePoint.CharacterTabulation:
            case CodePoint.Space:
            case CodePoint.LineFeed:
            case CodePoint.FormFeed:
            case CodePoint.CarriageReturn:
                // Consume as much whitespace as possible. Return a <whitespace-token>.
                consumeWhitespaceToken(context);
                break;

            // Digit
            case CodePoint.DigitZero:
            case CodePoint.DigitOne:
            case CodePoint.DigitTwo:
            case CodePoint.DigitThree:
            case CodePoint.DigitFour:
            case CodePoint.DigitFive:
            case CodePoint.DigitSix:
            case CodePoint.DigitSeven:
            case CodePoint.DigitEight:
            case CodePoint.DigitNine:
                consumeNumericToken(context);
                break;

            case CodePoint.LeftParenthesis:
                context.consumeTrivialToken(TokenType.OpenParenthesis);
                break;

            case CodePoint.RightParenthesis:
                context.consumeTrivialToken(TokenType.CloseParenthesis);
                break;

            case CodePoint.Comma:
                context.consumeTrivialToken(TokenType.Comma);
                break;

            case CodePoint.Colon:
                context.consumeTrivialToken(TokenType.Colon);
                break;

            case CodePoint.SemiColon:
                context.consumeTrivialToken(TokenType.Semicolon);
                break;

            case CodePoint.LeftSquareBracket:
                context.consumeTrivialToken(TokenType.OpenSquareBracket);
                break;

            case CodePoint.RightSquareBracket:
                context.consumeTrivialToken(TokenType.CloseSquareBracket);
                break;

            case CodePoint.LeftCurlyBracket:
                context.consumeTrivialToken(TokenType.OpenCurlyBracket);
                break;

            case CodePoint.RightCurlyBracket:
                context.consumeTrivialToken(TokenType.CloseCurlyBracket);
                break;

            case CodePoint.Apostrophe:
            case CodePoint.QuotationMark:
                // Consume a string token and return it.
                consumeStringToken(context);
                break;

            case CodePoint.NumberSign:
                // If the next input code point is an ident code point or the next two input code points are a
                // valid escape, then:
                if (
                    isIdentCodePoint(context.getRelativeCode(1))
                    || checkForValidEscape(context.getRelativeCode(1), context.getRelativeCode(2))
                ) {
                    const start = context.offset;

                    // 1. Create a <hash-token>.

                    // 2. If the next 3 input code points would start an ident sequence, set the <hash-token>’s
                    // type flag to "id".
                    // TODO: Uncomment when needed
                    // const props = {
                    //     typeFlag: checkForIdentStart(
                    //         context.getRelativeCode(1),
                    //         context.getRelativeCode(2),
                    //         context.getRelativeCode(3),
                    //     ) ? 'id' : 'unrestricted',
                    // };

                    // Consume an ident sequence, and set the <hash-token>’s value to the returned string.
                    context.consumeCodePoint();
                    consumeIndentSequence(context);

                    // 4. Return the <hash-token>.
                    // TODO: Uncomment when needed
                    // context.onToken(TokenType.Hash, start, context.offset, props);
                    context.onToken(TokenType.Hash, start, context.offset);
                    break;
                }

                // Otherwise, return a <delim-token> with its value set to the current input code point.
                context.consumeTrivialToken(TokenType.Delim);
                break;

            case CodePoint.PlusSign:
                // If the input stream starts with a number, reconsume the current input code point, consume a
                // numeric token, and return it.
                if (checkForNumberStart(
                    context.code,
                    context.getRelativeCode(1),
                    context.getRelativeCode(2),
                )) {
                    consumeNumericToken(context);
                    break;
                }

                // Otherwise, return a <delim-token> with its value set to the current input code point.
                context.consumeTrivialToken(TokenType.Delim);
                break;

            case CodePoint.HyphenMinus:
                // If the input stream starts with a number, reconsume the current input code point, consume a
                // numeric token, and return it.
                if (checkForNumberStart(context.code, context.getRelativeCode(1), context.getRelativeCode(2))) {
                    consumeNumericToken(context);
                    break;
                }

                // Otherwise, if the next 2 input code points are U+002D HYPHEN-MINUS U+003E GREATER-THAN SIGN
                // (>), consume them and return a <CDC-token>.
                if (context.getRelativeCode(1) === CodePoint.HyphenMinus
                        && context.getRelativeCode(2) === CodePoint.GreaterThanSign) {
                    context.consumeCodePoint(3);
                    context.onToken(TokenType.Cdc, context.offset - 3, context.offset);
                    break;
                }

                // Otherwise, if the input stream starts with an ident sequence, reconsume the current input
                // code point, consume an ident-like token, and return it.
                if (checkForIdentStart(context.code, context.getRelativeCode(1), context.getRelativeCode(2))) {
                    consumeIdentLikeToken(context);
                    break;
                }

                // Otherwise, return a <delim-token> with its value set to the current input code point.
                context.consumeTrivialToken(TokenType.Delim);
                break;

            case CodePoint.FullStop:
                // If the input stream starts with a number, reconsume the current input code point, consume a
                // numeric token, and return it.
                if (checkForNumberStart(context.code, context.getRelativeCode(1), context.getRelativeCode(2))) {
                    consumeNumericToken(context);
                    break;
                }

                // Otherwise, return a <delim-token> with its value set to the current input code point.
                context.consumeTrivialToken(TokenType.Delim);
                break;

            case CodePoint.LessThanSign:
                // If the next 3 input code points are U+0021 EXCLAMATION MARK U+002D HYPHEN-MINUS U+002D
                // HYPHEN-MINUS (!--), consume them and return a <CDO-token>.
                if (
                    context.getRelativeCode(1) === CodePoint.ExclamationMark
                        && context.getRelativeCode(2) === CodePoint.HyphenMinus
                        && context.getRelativeCode(3) === CodePoint.HyphenMinus
                ) {
                    context.consumeCodePoint(4);
                    context.onToken(TokenType.Cdo, context.offset - 4, context.offset);
                    break;
                }

                // Otherwise, return a <delim-token> with its value set to the current input code point.
                context.consumeTrivialToken(TokenType.Delim);
                break;

            case CodePoint.CommercialAt:
                // If the next 3 input code points would start an ident sequence, consume an ident sequence,
                // create an <at-keyword-token> with its value set to the returned value, and return it.
                if (checkForIdentStart(
                    context.getRelativeCode(1),
                    context.getRelativeCode(2),
                    context.getRelativeCode(3),
                )) {
                    const start = context.offset;

                    // Consume commercial at character
                    context.consumeCodePoint();

                    // Consume ident sequence after commercial at character
                    consumeIndentSequence(context);

                    context.onToken(TokenType.AtKeyword, start, context.offset);
                    break;
                }

                // Otherwise, return a <delim-token> with its value set to the current input code point.
                context.consumeTrivialToken(TokenType.Delim);
                break;

            case CodePoint.ReverseSolidus:
                // If the input stream starts with a valid escape, reconsume the current input code point,
                // consume an ident-like token, and return it.
                if (checkForValidEscape(context.code, context.getRelativeCode(1))) {
                    consumeIdentLikeToken(context);
                    break;
                }

                // Otherwise, this is a parse error. Return a <delim-token> with its value set to the current
                // input code point.
                context.consumeTrivialToken(TokenType.Delim);
                context.onError(ErrorMessage.InvalidEscapeSequence, context.offset - 1, context.offset);
                break;

            case CodePoint.Solidus:
                // If the next two input code point are U+002F SOLIDUS (/) followed by a U+002A ASTERISK (*),
                // If the preceding paragraph ended by consuming an EOF code point, this is a parse error.
                if (context.getRelativeCode(1) === CodePoint.Asterisk) {
                    const start = context.offset;

                    // Consume U+002F SOLIDUS (/) and U+002A ASTERISK (*)
                    context.consumeCodePoint(2);

                    // consume them and all following code points up to and including the first U+002A ASTERISK
                    // (*) followed by a U+002F SOLIDUS (/), or up to an EOF code point. Return to the start of
                    // this step.
                    context.consumeUntilCommentEnd();

                    if (context.isEof()) {
                        context.onError(
                            ErrorMessage.UnterminatedComment,
                            start,
                            context.length - 2,
                        );
                    }

                    context.onToken(TokenType.Comment, start, context.offset);
                    break;
                }

                // Otherwise, return a <delim-token> with its value set to the current input code point.
                context.consumeTrivialToken(TokenType.Delim);
                break;

            // anything else
            default:
                // Can't be optimized because of the control threshold
                if (isIdentStartCodePoint(context.code)) {
                    // Reconsume the current input code point, consume an ident-like token, and return it.
                    consumeIdentLikeToken(context);
                    break;
                }

                // Return a <delim-token> with its value set to the current input code point.
                context.consumeTrivialToken(TokenType.Delim);
        }
    }
};
