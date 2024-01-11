/**
 * @file Declaration list validator.
 */

import { decodeIdent, tokenizeExtended, TokenType } from '@adguard/css-tokenizer';
import { FORBIDDEN_CSS_FUNCTIONS } from './known-elements';
import { getErrorMessage } from '../../common/error';
import { CssValidationResult } from './css-validation-result';

const REMOVE_PROPERTY = 'remove';
const REMOVE_LENGTH = REMOVE_PROPERTY.length;

/**
 * Check if function name is forbidden. If so, throws an error.
 *
 * @param functionName Function name to check.
 * @throws Error if function name is forbidden.
 */
const checkFunctionName = (functionName: string): void => {
    // function name may contain escaped characters, like '\75' instead of 'u', so we need to decode it
    const decodedFunctionName = decodeIdent(functionName);

    if (FORBIDDEN_CSS_FUNCTIONS.has(decodedFunctionName)) {
        throw new Error(`Using '${decodedFunctionName}()' is not allowed`);
    }
};

/**
 * Does a basic validation of a declaration list.
 * Checks for unsafe resource loading and determines if the declaration list is an Extended CSS declaration list.
 *
 * @param declarationList Declaration list to validate.
 * @returns Validation result, see {@link CssValidationResult}.
 * @note This is a basic validation for the most necessary things, it does not guarantee that the CSS is completely
 * valid.
 */
export const validateDeclarationList = (declarationList: string): CssValidationResult => {
    const result: CssValidationResult = {
        isValid: true,
        isExtendedCss: false,
    };

    try {
        tokenizeExtended(declarationList, (token, start, end) => {
            switch (token) {
                // Special case: according to CSS specs, sometimes url() is handled as a separate token type
                case TokenType.Url:
                case TokenType.BadUrl:
                    throw new Error("Using 'url()' is not allowed");
                case TokenType.Function:
                    // we need -1 to exclude closing bracket, because function tokens look like 'func('
                    checkFunctionName(declarationList.slice(start, end - 1));
                    break;
                case TokenType.Ident:
                    // do a fast check before getting the substring
                    if (end - start === REMOVE_LENGTH) {
                        // TODO: Improve this check, and check the whole `remove: true` sequence.
                        // Please note that the `remove : true` case also valid.
                        if (decodeIdent(declarationList.slice(start, end)) === REMOVE_PROPERTY) {
                            result.isExtendedCss = true;
                        }
                    }
                    break;
                case TokenType.Comment:
                    throw new Error('Comments are not allowed in declaration lists');
                default:
                    break;
            }
        });
    } catch (error: unknown) {
        result.isValid = false;
        result.errorMessage = getErrorMessage(error);
    }

    return result;
};
