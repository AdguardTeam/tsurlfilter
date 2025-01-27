import { type TokenType, tokenizeExtended } from '@adguard/css-tokenizer';

/**
 * Represents an error that occurs when an operation is aborted.
 */
class AbortError extends Error {
    constructor() {
        super('Aborted');
    }
}

// TODO: AG-38480 add a stop function to the tokenizers callback and move `hasToken` to CSS Tokenizer as well
/**
 * Checks if the given raw string contains any of the specified tokens.
 * This function uses error throwing inside the abort tokenization process.
 *
 * @param raw - The raw string to be tokenized and checked.
 * @param tokens - A set of token types to check for in the raw string.
 * @returns `true` if any of the specified tokens are found in the raw string, otherwise `false`.
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
