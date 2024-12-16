import { type TokenType, tokenizeExtended } from '@adguard/css-tokenizer';

/**
 * Represents an error that occurs when an operation is aborted.
 */
class AbortError extends Error {
    constructor() {
        super('Aborted');
    }
}

// TODO: add a stop function to the tokenizers callback
/**
 * Checks if the given raw string contains any of the specified tokens.
 *
 * @param raw - The raw string to be tokenized and checked.
 * @param tokens - A set of token types to check for in the raw string.
 * @returns `true` if any of the specified tokens are found in the raw string, otherwise `false`.
 * @throws {AbortError} If a specified token is found during tokenization.
 */
export const hasToken = (raw: string, tokens: Set<TokenType>): boolean => {
    try {
        tokenizeExtended(
            raw,
            (type: TokenType) => {
                if (tokens.has(type)) {
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
