/**
 * @file Selector list validator.
 */

import { NATIVE_CSS_PSEUDO_CLASSES } from '@adguard/agtree';
import { decodeIdent, tokenizeExtended, TokenType } from '@adguard/css-tokenizer';

import { getErrorMessage } from '../../common/error';

import { type CssValidationResult } from './css-validation-result';
import {
    EXT_CSS_ATTRIBUTE_SELECTOR_PREFIX,
    SUPPORTED_CSS_PSEUDO_CLASSES,
    SUPPORTED_EXT_CSS_ATTRIBUTE_SELECTORS,
    SUPPORTED_EXT_CSS_PSEUDO_CLASSES,
} from './known-elements';

/**
 * Does a basic validation of a selector list.
 * Checks for unsupported pseudo-classes and attribute selectors,
 * and determines if the selector is an Extended CSS selector.
 *
 * Uses a single tokenization pass for optimal performance, combining both
 * validation and Extended CSS detection in one pass.
 *
 * @param selectorList Selector list to validate.
 *
 * @returns Validation result, see {@link CssValidationResult}.
 *
 * @note This is a basic validation for the most necessary things, it does not guarantee that the CSS is completely
 * valid.
 */
export const validateSelectorList = (selectorList: string): CssValidationResult => {
    const result: CssValidationResult = {
        isValid: true,
        isExtendedCss: false,
    };

    try {
        // Track Extended CSS detection during validation
        let hasStrictlyExtendedCss = false;
        let hasNativeCssPseudoClass = false;

        let prevIsDoubleColon = false;
        let prevToken: TokenType | undefined;
        let prevNonWhitespaceToken: TokenType | undefined;

        // Track :has() nesting depth - native CSS doesn't support nested :has()
        let hasDepth = 0;
        let isCurrentFunctionHas = false;

        // Track bracket balancing to detect unclosed brackets
        // Note: Curly brackets are explicitly rejected earlier, so we don't track them here
        const bracketStack: Array<{ type: TokenType; start: number; isHasFunction?: boolean }> = [];
        const bracketPairs = new Map([
            [TokenType.Function, TokenType.CloseParenthesis],
            [TokenType.OpenParenthesis, TokenType.CloseParenthesis],
            [TokenType.OpenSquareBracket, TokenType.CloseSquareBracket],
        ]);
        const closingBrackets = new Set(bracketPairs.values());

        tokenizeExtended(
            selectorList,
            (token, start, end) => {
                if (
                    (token === TokenType.Function || token === TokenType.Ident)
                    && prevToken === TokenType.Colon
                    && !prevIsDoubleColon
                ) {
                    // whitespace is NOT allowed between the ':' and the pseudo-class name, like ': active('
                    const name = selectorList.slice(
                        start,
                        // function tokens look like 'func(', so we need to remove the last character
                        token === TokenType.Function ? end - 1 : end,
                    );

                    // function name may contain escaped characters, like '\75' instead of 'u', so we need to decode it
                    const decodedName = decodeIdent(name);

                    if (SUPPORTED_EXT_CSS_PSEUDO_CLASSES.has(decodedName)) {
                        // This is always extended CSS (includes -abp-has, contains, etc.)
                        hasStrictlyExtendedCss = true;
                        result.isExtendedCss = true;
                    } else if (NATIVE_CSS_PSEUDO_CLASSES.has(decodedName)) {
                        // Track pseudo-classes that can be both native and extended (:has, :is, :not)
                        hasNativeCssPseudoClass = true;

                        // Track :has() nesting - native CSS doesn't support nested :has()
                        // https://developer.mozilla.org/en-US/docs/Web/CSS/:has#syntax
                        if (token === TokenType.Function && decodedName === 'has') {
                            hasDepth += 1;
                            isCurrentFunctionHas = true;
                            // If we're already inside a :has() (depth > 1), this is nested :has()
                            // which is not supported in native CSS but is supported in ExtendedCSS
                            if (hasDepth > 1) {
                                hasStrictlyExtendedCss = true;
                                result.isExtendedCss = true;
                            }
                        }
                    } else if (!SUPPORTED_CSS_PSEUDO_CLASSES.has(decodedName)) {
                        throw new Error(`Unsupported pseudo-class: ':${decodedName}'`);
                    }

                    // Reset the flag after processing
                    if (token !== TokenType.Function) {
                        isCurrentFunctionHas = false;
                    }
                } else if (token === TokenType.Ident && prevNonWhitespaceToken === TokenType.OpenSquareBracket) {
                    // whitespace is allowed between the '[' and the attribute name, like '[ attr]'
                    const attributeName = selectorList.slice(start, end);

                    if (attributeName.startsWith(EXT_CSS_ATTRIBUTE_SELECTOR_PREFIX)) {
                        hasStrictlyExtendedCss = true;
                        result.isExtendedCss = true;

                        if (!SUPPORTED_EXT_CSS_ATTRIBUTE_SELECTORS.has(attributeName)) {
                            throw new Error(`Unsupported Extended CSS attribute selector: '${attributeName}'`);
                        }
                    }
                } else if (token === TokenType.OpenCurlyBracket || token === TokenType.CloseCurlyBracket) {
                    throw new Error('Curly brackets are not allowed in selector lists');
                } else if (token === TokenType.Comment) {
                    throw new Error('Comments are not allowed in selector lists');
                }

                // memorize tokens, we need them later
                if (token === TokenType.Colon) {
                    prevIsDoubleColon = prevToken === TokenType.Colon;
                }

                prevToken = token;

                if (token !== TokenType.Whitespace) {
                    prevNonWhitespaceToken = token;
                }

                // Track bracket balancing
                if (bracketPairs.has(token)) {
                    bracketStack.push({ type: token, start, isHasFunction: isCurrentFunctionHas });
                    // Reset the flag after pushing to stack
                    isCurrentFunctionHas = false;
                } else if (closingBrackets.has(token)) {
                    const lastOpening = bracketStack[bracketStack.length - 1];
                    const expectedClosing = lastOpening ? bracketPairs.get(lastOpening.type) : undefined;

                    if (expectedClosing === token) {
                        const popped = bracketStack.pop();
                        // Decrement :has() depth when exiting a :has() function
                        if (popped?.isHasFunction) {
                            hasDepth -= 1;
                        }
                    } else {
                        // Mismatched bracket - determine token and expected names
                        let tokenName: string;
                        if (token === TokenType.CloseParenthesis) {
                            tokenName = ')';
                        } else if (token === TokenType.CloseSquareBracket) {
                            tokenName = ']';
                        } else {
                            tokenName = 'unknown';
                        }

                        let expectedName: string;
                        if (expectedClosing === TokenType.CloseParenthesis) {
                            expectedName = '<)-token>';
                        } else if (expectedClosing === TokenType.CloseSquareBracket) {
                            expectedName = '<]-token>';
                        } else {
                            expectedName = 'unknown';
                        }

                        throw new SyntaxError(`Expected '${expectedName}', but got '${tokenName}'`);
                    }
                }
            },
        );

        // Check for unclosed brackets
        if (bracketStack.length > 0) {
            const unclosedBracket = bracketStack[bracketStack.length - 1];
            let expectedName: string;
            if (unclosedBracket.type === TokenType.Function
                || unclosedBracket.type === TokenType.OpenParenthesis) {
                expectedName = '<)-token>';
            } else {
                // Must be OpenSquareBracket (curly brackets are rejected earlier)
                expectedName = '<]-token>';
            }
            throw new SyntaxError(`Expected '${expectedName}', but got 'end of input'`);
        }

        // If selector contains native pseudo-classes
        // i.e :has, :is, :not,
        // AND it also contains strictly extended CSS,
        // mark the whole thing as extended CSS.
        // Otherwise, :has/:is/:not alone are treated as native CSS.
        if (hasNativeCssPseudoClass && hasStrictlyExtendedCss) {
            result.isExtendedCss = true;
        }
    } catch (error: unknown) {
        result.isValid = false;
        result.errorMessage = getErrorMessage(error);
    }

    return result;
};
