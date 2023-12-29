/**
 * @file CSS token stream.
 */

import { TokenType, getFormattedTokenName } from '@adguard/css-tokenizer';
import { sprintf } from 'sprintf-js';

import { tokenizeBalanced } from './balancing';
import { EMPTY } from '../../utils/constants';
import { type Location, defaultLocation } from '../common';
import { AdblockSyntaxError } from '../../errors/adblock-syntax-error';
import { locRange } from '../../utils/location';
import { END_OF_INPUT, ERROR_MESSAGES } from './constants';
import { ABP_EXT_CSS_PREFIX, EXT_CSS_PSEUDO_CLASSES, LEGACY_EXT_CSS_ATTRIBUTE_PREFIX } from '../../converter/data/css';

/**
 * Interface for CSS token data.
 */
export interface TokenData {
    /**
     * Type of the token.
     */
    type: TokenType;

    /**
     * Start index in the source string.
     */
    start: number;

    /**
     * End index in the source string.
     */
    end: number;

    /**
     * Balance level of the token.
     */
    balance: number;
}

/**
 * Interface for expectation data.
 */
export interface ExpectationData {
    /**
     * Expected balance level of the token (optional).
     */
    balance?: number;

    /**
     * Expected value of the token (optional).
     */
    value?: string;
}

/**
 * Interface for skipUntilEx result.
 */
export interface SkipUntilExResult {
    /**
     * Number of tokens skipped.
     */
    skipped: number;

    /**
     * Number of tokens skipped without leading and trailing whitespace tokens.
     */
    skippedTrimmed: number;
}

/**
 * Represents a stream of CSS tokens.
 */
export class CssTokenStream {
    /**
     * The tokens in the stream.
     */
    private tokens: TokenData[] = [];

    /**
     * The source string.
     */
    public readonly source: string = EMPTY;

    /**
     * The current index in the stream.
     */
    private index = 0;

    /**
     * The base location of the source string.
     */
    private baseLoc: Location;

    /**
     * Initializes a new instance of the TokenStream class.
     *
     * @param source The source string to tokenize.
     * @param baseLoc The base location of the source string.
     */
    constructor(source: string, baseLoc = defaultLocation) {
        this.source = source;

        // Tokenize the source string with the CSS tokenizer and add balance level to each token.
        // 'onToken' callback is invoked when a token is found in the source string.
        // Passed parameters:
        // - type: type of the token
        // - start: start index of the token
        // - end: end index of the token
        // - props: additional properties of the token, if any (we don't use it here, this is why we use underscore)
        // - balance: balance level of the token
        tokenizeBalanced(source, (type, start, end, _, balance) => {
            this.tokens.push({
                type,
                start,
                end,
                balance,
            });
        });

        this.index = 0;

        this.baseLoc = baseLoc;
    }

    /**
     * Gets the number of tokens in the stream.
     *
     * @returns The number of tokens in the stream.
     */
    public get length(): number {
        return this.tokens.length;
    }

    /**
     * Checks if the end of the token stream is reached.
     *
     * @returns True if the end of the stream is reached, otherwise false.
     */
    public isEof(): boolean {
        return this.index >= this.tokens.length;
    }

    /**
     * Gets the token at the specified index.
     *
     * @param index The index of the token to retrieve.
     * @returns The token at the specified index or undefined if the index is out of bounds.
     */
    public get(index: number = this.index): TokenData | undefined {
        return this.tokens[index];
    }

    /**
     * Gets the token at the specified index or throws if no token is found at the specified index.
     *
     * @param index The index of the token to retrieve.
     * @returns The token at the specified index or undefined if the index is out of bounds.
     * @throws If no token is found at the specified index.
     */
    public getOrFail(index: number = this.index): TokenData {
        const token = this.get(index);

        if (!token) {
            throw new AdblockSyntaxError(
                sprintf(
                    ERROR_MESSAGES.EXPECTED_ANY_TOKEN_BUT_GOT,
                    END_OF_INPUT,
                ),
                locRange(this.baseLoc, this.source.length - 1, this.source.length),
            );
        }

        return token;
    }

    /**
     * Gets the source fragment of the token at the specified index.
     *
     * @param index The index of the token to retrieve the fragment for.
     * @returns The source fragment of the token or an empty string if the index is out of bounds.
     */
    public fragment(index: number = this.index): string {
        const token = this.get(index);

        if (token) {
            return this.source.slice(token.start, token.end);
        }

        return EMPTY;
    }

    /**
     * Moves the index to the next token and returns it.
     *
     * @returns The next token or undefined if the end of the stream is reached.
     */
    public advance(): TokenData | undefined {
        if (this.isEof()) {
            return undefined;
        }

        this.index += 1;

        return this.tokens[this.index];
    }

    /**
     * Looks ahead in the stream without changing the index.
     *
     * @param index The relative index to look ahead to, starting from the current index.
     * @returns The next token or undefined if the end of the stream is reached.
     */
    public lookahead(index = 1): TokenData | undefined {
        return this.tokens[this.index + Math.max(1, index)];
    }

    /**
     * Looks behind in the stream without changing the index.
     *
     * @param index The relative index to look behind to, starting from the current index.
     * @returns The previous token or undefined if the current token is the first in the stream.
     */
    public lookbehind(index = 1): TokenData | undefined {
        if (this.index === 0) {
            return undefined;
        }

        return this.tokens[this.index - Math.max(1, index)];
    }

    /**
     * Looks behind in the stream for the previous non-whitespace token without changing the index.
     *
     * @returns The previous non-whitespace token or undefined if it could not be found.
     */
    public lookbehindForNonWs(): TokenData | undefined {
        for (let i = this.index - 1; i >= 0; i -= 1) {
            if (this.tokens[i].type !== TokenType.Whitespace) {
                return this.tokens[i];
            }
        }

        return undefined;
    }

    /**
     * Skips whitespace tokens in the stream.
     */
    public skipWhitespace(): void {
        while (this.get()?.type === TokenType.Whitespace) {
            this.index += 1;
        }
    }

    /**
     * Skips tokens until the current balance level is reached.
     *
     * @returns The number of tokens skipped.
     */
    public skipUntilBalanced(): number {
        if (this.isEof()) {
            return 0;
        }

        // It is safe to use ! here, because we check for EOF above
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const currentBalance = this.get()!.balance;

        // If the current balance is 0, do nothing
        if (currentBalance === 0) {
            return 0;
        }

        // Otherwise, skip tokens until the balance is the current balance - 1
        let skipped = 0;

        while (!this.isEof() && this.get()?.balance !== currentBalance - 1) {
            this.index += 1;
            skipped += 1;
        }

        return skipped;
    }

    /**
     * Skips tokens until a token with the specified type or the end of the stream is reached.
     *
     * @param type The type of token to skip until.
     * @param balance The balance level of the token to skip until.
     * @returns The number of tokens skipped.
     */
    public skipUntil(type: TokenType, balance?: number): number {
        let skipped = 0;

        while (
            !this.isEof()
            && (this.get()?.type !== type || (balance !== undefined && this.get()?.balance !== balance))
        ) {
            this.index += 1;
            skipped += 1;
        }

        return skipped;
    }

    /**
     * Skips tokens until a token with the specified type or the end of the stream is reached. This is an extended
     * version of skipUntil that also returns the number of tokens skipped without calculating leading and trailing
     * whitespace tokens.
     *
     * @param type The type of token to skip until.
     * @param balance The balance level of the token to skip until.
     * @returns An array containing the number of tokens skipped and the number of tokens skipped without leading and
     * trailing whitespace tokens.
     */
    public skipUntilEx(type: TokenType, balance: number): SkipUntilExResult {
        let i = this.index;
        let firstNonWsToken = -1; // -1 means no non-whitespace token found yet
        let lastNonWsToken = -1; // -1 means no non-whitespace token found yet

        while (i < this.tokens.length) {
            const currentToken = this.tokens[i];

            if (currentToken.type === TokenType.Whitespace) {
                i += 1;
                continue;
            } else if (currentToken.type === type && currentToken.balance === balance) {
                break;
            }

            if (firstNonWsToken === -1) {
                firstNonWsToken = i;
            }

            lastNonWsToken = i;

            i += 1;
        }

        const skipped = i - this.index;
        this.index = i;

        return {
            skipped,
            // if firstNonWsToken is -1, then lastNonWsToken is also -1
            skippedTrimmed: firstNonWsToken === -1 ? 0 : lastNonWsToken - firstNonWsToken + 1,
        };
    }

    /**
     * Expects that the end of the stream is not reached.
     */
    public expectNotEof(): void {
        if (this.isEof()) {
            throw new AdblockSyntaxError(
                'Unexpected end of input',
                locRange(this.baseLoc, this.source.length - 1, this.source.length),
            );
        }
    }

    /**
     * Expects the current token to have a specific type and optional value and balance level.
     *
     * @param type The expected token type.
     * @param data Optional expectation data.
     * @throws If the end of the stream is reached or if the token type or expectation data does not match.
     */
    public expect(type: TokenType, data?: ExpectationData): void {
        const token = this.get();

        if (!token) {
            throw new AdblockSyntaxError(
                sprintf(
                    ERROR_MESSAGES.EXPECTED_TOKEN_BUT_GOT,
                    getFormattedTokenName(type),
                    END_OF_INPUT,
                ),
                locRange(this.baseLoc, this.source.length - 1, this.source.length),
            );
        }

        if (token.type !== type) {
            throw new AdblockSyntaxError(
                sprintf(
                    ERROR_MESSAGES.EXPECTED_TOKEN_BUT_GOT,
                    getFormattedTokenName(type),
                    getFormattedTokenName(token.type),
                ),
                locRange(this.baseLoc, token.start, token.end),
            );
        }

        if (data?.balance !== undefined && token.balance !== data.balance) {
            throw new AdblockSyntaxError(
                sprintf(
                    ERROR_MESSAGES.EXPECTED_TOKEN_WITH_BALANCE_BUT_GOT,
                    getFormattedTokenName(type),
                    data.balance,
                    token.balance,
                ),
                locRange(this.baseLoc, token.start, token.end),
            );
        }

        if (data?.value && this.fragment() !== data.value) {
            throw new AdblockSyntaxError(
                sprintf(
                    ERROR_MESSAGES.EXPECTED_TOKEN_WITH_VALUE_BUT_GOT,
                    getFormattedTokenName(type),
                    data.value,
                    this.fragment(),
                ),
                locRange(this.baseLoc, token.start, token.end),
            );
        }
    }

    /**
     * Gets the balance level of the token at the specified index.
     *
     * @param index The index of the token to retrieve the balance level for.
     * @returns The balance level of the token or 0 if the index is out of bounds.
     */
    public getBalance(index: number = this.index): number {
        return this.tokens[index]?.balance || 0;
    }

    /**
     * Checks whether the token stream contains any Extended CSS elements, such as `:has()`, `:contains()`, etc.
     *
     * @returns `true` if the stream contains any Extended CSS elements, otherwise `false`.
     */
    public hasAnySelectorExtendedCssNode(): boolean {
        for (let i = 0; i < this.tokens.length; i += 1) {
            const token = this.tokens[i];

            if (token.type === TokenType.Function) {
                const name = this.source.substring(token.start, token.end - 1); // omit the last parenthesis

                if (EXT_CSS_PSEUDO_CLASSES.has(name)) {
                    return true;
                }
            } else if (token.type === TokenType.OpenSquareBracket) {
                let j = i + 1;

                // skip whitespace
                while (j < this.tokens.length && this.tokens[j].type === TokenType.Whitespace) {
                    j += 1;
                }

                if (j < this.tokens.length && this.tokens[j].type === TokenType.Ident) {
                    const attr = this.source.slice(this.tokens[j].start, this.tokens[j].end);

                    // [-ext-<name>=...] or [-abp-<name>=...]
                    if (attr.startsWith(LEGACY_EXT_CSS_ATTRIBUTE_PREFIX) || attr.startsWith(ABP_EXT_CSS_PREFIX)) {
                        return true;
                    }
                }

                // do not check these tokens again
                i = j;
            }
        }

        return false;
    }
}
