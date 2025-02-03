/**
 * @file hasToken function
 */
import { type TokenType } from '../common/enums/token-types';
import { tokenizeExtended } from '../extended-css-tokenizer';
import { type TokenizerFunction } from '../common/types/function-prototypes';

/**
 * Checks if the given raw string contains any of the specified tokens.
 *
 * @param raw - The raw string to be tokenized and checked.
 * @param tokens - A set of token types to check for in the raw string.
 * @param tokenizer - The tokenizer function to use. Defaults to `tokenizeExtended`.
 * @returns `true` if any of the specified tokens are found in the raw string, otherwise `false`.
 */
export const hasToken = (
    raw: string,
    tokens: Set<TokenType>,
    tokenizer: TokenizerFunction = tokenizeExtended,
): boolean => {
    let found = false;

    tokenizer(
        raw,
        (type, start, end, props, stop) => {
            if (tokens.has(type)) {
                found = true;
                stop();
            }
        },
    );

    return found;
};
