import { type TokenType, tokenizeExtended } from '@adguard/css-tokenizer';

class AbortError extends Error {
    constructor() {
        super('Aborted');
    }
}

// #TODO: add a stop function to the tokenizers callback
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