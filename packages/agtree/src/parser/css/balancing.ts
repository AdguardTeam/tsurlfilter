/**
 * @file Tokenizer helpers for balanced pairs.
 */

import {
    TokenType,
    tokenizeExtended,
    type OnErrorCallback,
    type OnTokenCallback,
    type TokenizerContextFunction,
    getFormattedTokenName,
} from '@adguard/css-tokenizer';
import { sprintf } from 'sprintf-js';

import { AdblockSyntaxError } from '../../errors/adblock-syntax-error';
import { END_OF_INPUT, ERROR_MESSAGES } from './constants';

/**
 * Utility type to get the last element from a tuple, handling optional last elements correctly.
 *
 * @param T - The tuple to extract the last element from.
 * @returns The last element of the tuple if present; `L | undefined` if the last element is optional.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type Last<T extends unknown[]> = T extends [...infer _I, infer L]
    ? L
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    : T extends [...infer _I, (infer L)?] ? L | undefined : never;

/**
 * Utility type to remove the last element from a tuple, handling optional last elements correctly.
 *
 * @param T - The tuple to remove the last element from.
 * @returns A tuple without the last element. If the last element is optional, it is also removed.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type OmitLast<T extends unknown[]> = T extends [...infer Rest, infer _Last]
    ? Rest
    // Handles cases where the last element is optional
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    : T extends [...infer Rest, (infer _Last)?]
        ? Rest
        : never;

/**
 * Extracts the parameters of `OnTokenCallback` as a tuple.
 */
type OnTokenCallbackParameters = Parameters<OnTokenCallback>;

/**
 * Extended version of `OnTokenCallback` which also receives a `balance` parameter.
 *
 * @param type Type of the token.
 * @param start Start index in the source string.
 * @param end End index in the source string.
 * @param props Additional properties of the token (if any - can be `undefined`, depending on the token type).
 * @param balance Calculated balance level of the token.
 * @param stop Function to halt tokenization.
 * @note This function is keeping the same signature as the original `OnTokenCallback` to avoid breaking changes,
 * just adding the `balance` parameter at the end.
 */
export type OnBalancedTokenCallback = (
    ...args: [...OmitLast<OnTokenCallbackParameters>, balance: number, Last<OnTokenCallbackParameters>]
) => ReturnType<OnTokenCallback>;

/**
 * Map of opening tokens to their corresponding closing tokens.
 */
const standardTokenPairs = new Map<TokenType, TokenType>([
    [TokenType.Function, TokenType.CloseParenthesis],
    [TokenType.OpenParenthesis, TokenType.CloseParenthesis],
    [TokenType.OpenSquareBracket, TokenType.CloseSquareBracket],
    [TokenType.OpenCurlyBracket, TokenType.CloseCurlyBracket],
]);

/**
 * Map of opening tokens to their corresponding closing tokens just for function calls. This makes possible a more
 * lightweight and tolerant check for balanced pairs in some cases.
 */
const functionTokenPairs = new Map<TokenType, TokenType>([
    [TokenType.Function, TokenType.CloseParenthesis],
    [TokenType.OpenParenthesis, TokenType.CloseParenthesis],
]);

/**
 * Helper function to tokenize and ensure balanced pairs.
 *
 * @param raw Raw CSS string to tokenize
 * @param onToken Callback which will be invoked for each token, extended with a `balance` parameter
 * @param onError Error callback which is called when a parsing error is found (optional)
 * @param functionHandlers Custom function handlers (optional)
 * @param tokenPairs Map of opening tokens to their corresponding closing tokens
 * @throws If the input is not balanced
 * @todo Consider adding a `tolerant` flag if error throwing seems too aggressive in the future
 */
const tokenizeWithBalancedPairs = (
    raw: string,
    onToken: OnBalancedTokenCallback,
    onError: OnErrorCallback = () => {},
    functionHandlers?: Map<number, TokenizerContextFunction>,
    tokenPairs: Map<TokenType, TokenType> = standardTokenPairs,
) => {
    const stack: TokenType[] = [];
    const values = new Set(tokenPairs.values());

    tokenizeExtended(
        raw,
        (type: TokenType, start, end, props, stop) => {
            if (tokenPairs.has(type)) {
                // If the token is an opening token, push its corresponding closing token to the stack.
                // It is safe to use non-null assertion here, because we have checked that the token exists in the map.
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                stack.push(tokenPairs.get(type)!);
            } else if (values.has(type)) {
                // If the token is a closing token, check if it matches the last opening token, and if so, pop it.
                if (stack[stack.length - 1] === type) {
                    stack.pop();
                } else {
                    throw new AdblockSyntaxError(
                        sprintf(
                            ERROR_MESSAGES.EXPECTED_TOKEN_BUT_GOT,
                            getFormattedTokenName(stack[stack.length - 1]),
                            getFormattedTokenName(type),
                        ),
                        start,
                        raw.length,
                    );
                }
            }

            onToken(type, start, end, props, stack.length, stop);
        },
        onError,
        functionHandlers,
    );

    // If the stack is not empty, then there are some opening tokens that were not closed.
    if (stack.length > 0) {
        throw new AdblockSyntaxError(
            sprintf(
                ERROR_MESSAGES.EXPECTED_TOKEN_BUT_GOT,
                getFormattedTokenName(stack[stack.length - 1]),
                END_OF_INPUT,
            ),
            raw.length - 1,
            raw.length,
        );
    }
};

/**
 * Tokenize and ensure balanced pairs for standard CSS.
 *
 * @param raw Raw CSS string to tokenize
 * @param onToken Callback which will be invoked for each token, extended with a `balance` parameter
 * @param onError Error callback which is called when a parsing error is found (optional)
 * @param functionHandlers Custom function handlers (optional)
 * @throws If the input is not balanced
 */
export const tokenizeBalanced = (
    raw: string,
    onToken: OnBalancedTokenCallback,
    onError: OnErrorCallback = () => {},
    functionHandlers?: Map<number, TokenizerContextFunction>,
) => {
    tokenizeWithBalancedPairs(raw, onToken, onError, functionHandlers);
};

/**
 * Tokenize and ensure balanced pairs for function calls.
 *
 * @param raw Raw CSS string to tokenize
 * @param onToken Callback which will be invoked for each token, extended with a `balance` parameter
 * @param onError Error callback which is called when a parsing error is found (optional)
 * @param functionHandlers Custom function handlers (optional)
 * @throws If the input is not balanced
 */
export const tokenizeFnBalanced = (
    raw: string,
    onToken: OnBalancedTokenCallback,
    onError: OnErrorCallback = () => {},
    functionHandlers?: Map<number, TokenizerContextFunction>,
) => {
    tokenizeWithBalancedPairs(raw, onToken, onError, functionHandlers, functionTokenPairs);
};
