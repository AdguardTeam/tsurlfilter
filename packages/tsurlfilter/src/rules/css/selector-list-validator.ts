/**
 * @file Selector list validator.
 */

import { CssTokenStream, NATIVE_AND_EXT_CSS_PSEUDO_CLASSES } from '@adguard/agtree';
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
        // Check if selector contains strictly extended CSS (excludes natively supported :has(), :is(), :not())
        const stream = new CssTokenStream(selectorList);
        const hasStrictlyExtendedCss = stream.hasAnySelectorExtendedCssNodeStrict();
        // Check if selector contains any pseudo-classes that can be both native and extended (:has, :is, :not)
        const hasNativeAndExtCss = stream.hasAnySelectorNativeAndExtCssNode();

        let prevIsDoubleColon = false;
        let prevToken: TokenType | undefined;
        let prevNonWhitespaceToken: TokenType | undefined;

        tokenizeExtended(selectorList, (token, start, end) => {
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
                    result.isExtendedCss = true;
                } else if (
                    !SUPPORTED_CSS_PSEUDO_CLASSES.has(decodedName)
                    && !NATIVE_AND_EXT_CSS_PSEUDO_CLASSES.has(decodedName)
                ) {
                    throw new Error(`Unsupported pseudo-class: ':${decodedName}'`);
                }
            } else if (token === TokenType.Ident && prevNonWhitespaceToken === TokenType.OpenSquareBracket) {
                // whitespace is allowed between the '[' and the attribute name, like '[ attr]'
                const attributeName = selectorList.slice(start, end);

                if (attributeName.startsWith(EXT_CSS_ATTRIBUTE_SELECTOR_PREFIX)) {
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
        });

        // If selector contains pseudo-classes
        // that can be native or extended (:has, :is, :not)
        // AND it also contains strictly extended CSS,
        // mark the whole thing as extended CSS.
        // Otherwise, :has/:is/:not alone are treated as native CSS
        if (hasNativeAndExtCss && hasStrictlyExtendedCss) {
            result.isExtendedCss = true;
        }
    } catch (error: unknown) {
        result.isValid = false;
        result.errorMessage = getErrorMessage(error);
    }

    return result;
};
