/**
 * @file hasToken function
 */
import { type TokenType } from './common/enums/token-types';
import { type HasToken } from './common/types/function-prototypes';
import { tokenizeExtended } from './extended-css-tokenizer';

/**
 * Represents an error that occurs when an operation is aborted.
 */
class AbortError extends Error {
    constructor() {
        super('Aborted');
    }
}

/**
 * Checks if the given raw string contains any of the specified tokens.
 * This function uses error throwing inside the abort tokenization process.
 *
 * @param raw - The raw string to be tokenized and checked.
 * @param tokens - A set of token types to check for in the raw string.
 * @returns `true` if any of the specified tokens are found in the raw string, otherwise `false`.
 * @throws If the tokenization process is aborted.
 */
export const hasToken: HasToken = (raw: string, tokens: Set<TokenType>) => {
    let stop = false;

    try {
        tokenizeExtended(
            raw,
            (type: TokenType) => {
                if (stop) return;
                if (tokens.has(type)) {
                    stop = true;
                    throw new AbortError();
                }
            },
        );
    } catch (e) {
        if (e instanceof AbortError) {
            return true;
        }
        throw e;
    }
    return false;
};
