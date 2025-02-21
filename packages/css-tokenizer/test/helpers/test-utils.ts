import { expect } from 'vitest';

import { getFormattedTokenName } from '../../src/utils/token-names';
import { type TokenType } from '../../src/common/enums/token-types';
import { type TokenData, type TokenTest } from './test-interfaces';
import { tokenize } from '../../src/css-tokenizer';
import { type tokenizeExtended } from '../../src/extended-css-tokenizer';

const SEPARATOR = ', ';

// TODO: Maybe useful for the future
// /**
//  * A simple helper function to get a comma-separated list of token names.
//  *
//  * @param args Array of token types
//  * @returns Formatted token name list separated by comma
//  */
// export const getTokenNameList = (...args: TokenType[]): string => {
//     return args.map(getFormattedTokenName).join(SEPARATOR);
// };

/**
 * A simple helper function to get a comma-separated list of token names, but if a token name is occurs multiple times
 * after each other, it is replaced with a single token name and a multiplier, e.g. `<token-name> x <multiplier>`.
 *
 * @param args Array of token types
 *
 * @returns Formatted token name list separated by comma
 */
export const getTokenNameList = (...args: TokenType[]): string => {
    const result: string[] = [];
    let lastToken: string | null = null;
    let multiplier = 0;

    for (const token of args.map(getFormattedTokenName)) {
        if (token === lastToken) {
            multiplier += 1;
        } else {
            if (lastToken !== null) {
                result.push(`${lastToken}${multiplier > 1 ? ` x ${multiplier}` : ''}`);
            }

            lastToken = token;
            multiplier = 1;
        }
    }

    if (lastToken !== null) {
        result.push(`${lastToken}${multiplier > 1 ? ` x ${multiplier}` : ''}`);
    }

    return result.join(SEPARATOR);
};

/**
 * A simple helper function to add `as` property to token tests. This is useful for generating meaningful test names.
 *
 * @param tests Token tests
 *
 * @returns Modified token tests (with `as` property added to array items)
 *
 * @note It modifies the original array
 */
export const addAsProp = (tests: TokenTest[]): TokenTest[] => {
    tests.forEach((test) => {
        // eslint-disable-next-line no-param-reassign
        test.as = getTokenNameList(...test.expected.map((token) => token[0]));
    });

    return tests;
};

/**
 * Helper function to test tokenization, it is enough in most cases.
 *
 * @param test Token test
 * @param fn Tokenizer function
 */
export const testTokenization = (
    test: TokenTest,
    fn: typeof tokenize | typeof tokenizeExtended = tokenize,
): void => {
    const tokens: TokenData[] = [];

    // Ignore props and stop for test
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    fn(test.actual, (type, start, end, _props, _stop) => {
        tokens.push([type, start, end]);
    });

    // Now compare the trimmed (or sliced) tokens against your `test.expected`
    expect(tokens).toEqual(test.expected);
};
