/**
 * @file Utility functions for working with quotes
 */

import {
    BACKTICK_QUOTE,
    CLOSE_CURLY_DOUBLE_QUOTE,
    CLOSE_CURLY_QUOTE,
    COMMA,
    DOUBLE_QUOTE,
    EMPTY,
    ESCAPE_CHARACTER,
    OPEN_CURLY_DOUBLE_QUOTE,
    OPEN_CURLY_QUOTE,
    SINGLE_QUOTE,
    SPACE,
} from './constants';

/**
 * Set of all possible quote characters supported by the library
 */
export const QUOTE_SET = new Set([
    SINGLE_QUOTE,
    DOUBLE_QUOTE,
    BACKTICK_QUOTE,
]);

/**
 * Possible quote types for scriptlet parameters
 */
export const QuoteType = {
    /**
     * No quotes at all
     */
    None: 'none',

    /**
     * Single quotes (`'`)
     */
    Single: 'single',

    /**
     * Double quotes (`"`)
     */
    Double: 'double',

    /**
     * Backtick quotes (`` ` ``)
     */
    Backtick: 'backtick',

    /**
     * Curly quotes (`‘` `’`)
     */
    Curly: 'curly',

    /**
     * Double curly quotes (`“` `”`)
     */
    DoubleCurly: 'doublecurly',
} as const;

// intentionally naming the variable the same as the type
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type QuoteType = typeof QuoteType[keyof typeof QuoteType];

/**
 * Utility functions for working with quotes
 */
export class QuoteUtils {
    /**
     * Escape all unescaped occurrences of the character
     *
     * @param string String to escape
     * @param char Character to escape
     * @returns Escaped string
     */
    public static escapeUnescapedOccurrences(string: string, char: string): string {
        let result = EMPTY;

        for (let i = 0; i < string.length; i += 1) {
            if (string[i] === char && (i === 0 || string[i - 1] !== ESCAPE_CHARACTER)) {
                result += ESCAPE_CHARACTER;
            }

            result += string[i];
        }

        return result;
    }

    /**
     * Unescape all single escaped occurrences of the character
     *
     * @param string String to unescape
     * @param char Character to unescape
     * @returns Unescaped string
     */
    public static unescapeSingleEscapedOccurrences(string: string, char: string): string {
        let result = EMPTY;

        for (let i = 0; i < string.length; i += 1) {
            if (
                string[i] === char
                && string[i - 1] === ESCAPE_CHARACTER
                && (i === 1 || string[i - 2] !== ESCAPE_CHARACTER)
            ) {
                result = result.slice(0, -1);
            }

            result += string[i];
        }

        return result;
    }

    /**
     * Get quote type of the string
     *
     * @param string String to check
     * @returns Quote type of the string
     */
    public static getStringQuoteType(string: string): QuoteType {
        // Don't check 1-character strings to avoid false positives
        if (string.length > 1) {
            if (string.startsWith(SINGLE_QUOTE) && string.endsWith(SINGLE_QUOTE)) {
                return QuoteType.Single;
            }

            if (string.startsWith(DOUBLE_QUOTE) && string.endsWith(DOUBLE_QUOTE)) {
                return QuoteType.Double;
            }

            if (string.startsWith(BACKTICK_QUOTE) && string.endsWith(BACKTICK_QUOTE)) {
                return QuoteType.Backtick;
            }

            if (string.startsWith(OPEN_CURLY_DOUBLE_QUOTE) && string.endsWith(CLOSE_CURLY_DOUBLE_QUOTE)) {
                return QuoteType.DoubleCurly;
            }

            if (string.startsWith(OPEN_CURLY_QUOTE) && string.endsWith(CLOSE_CURLY_QUOTE)) {
                return QuoteType.Curly;
            }
        }

        return QuoteType.None;
    }

    /**
     * Set quote type of the string
     *
     * @param string String to set quote type of
     * @param quoteType Quote type to set
     * @returns String with the specified quote type
     */
    public static setStringQuoteType(string: string, quoteType: QuoteType): string {
        const actualQuoteType = QuoteUtils.getStringQuoteType(string);

        switch (quoteType) {
            case QuoteType.None:
                if (actualQuoteType === QuoteType.Single) {
                    return QuoteUtils.escapeUnescapedOccurrences(string.slice(1, -1), SINGLE_QUOTE);
                }

                if (actualQuoteType === QuoteType.Double) {
                    return QuoteUtils.escapeUnescapedOccurrences(string.slice(1, -1), DOUBLE_QUOTE);
                }

                if (actualQuoteType === QuoteType.Backtick) {
                    return QuoteUtils.escapeUnescapedOccurrences(string.slice(1, -1), BACKTICK_QUOTE);
                }

                return string;

            case QuoteType.Single:
                if (actualQuoteType === QuoteType.None) {
                    return SINGLE_QUOTE + QuoteUtils.escapeUnescapedOccurrences(string, SINGLE_QUOTE) + SINGLE_QUOTE;
                }

                if (actualQuoteType === QuoteType.Double) {
                    return SINGLE_QUOTE
                        + QuoteUtils.escapeUnescapedOccurrences(
                            QuoteUtils.unescapeSingleEscapedOccurrences(string.slice(1, -1), DOUBLE_QUOTE),
                            SINGLE_QUOTE,
                        ) + SINGLE_QUOTE;
                }

                if (actualQuoteType === QuoteType.Backtick) {
                    return SINGLE_QUOTE
                        + QuoteUtils.escapeUnescapedOccurrences(
                            QuoteUtils.unescapeSingleEscapedOccurrences(string.slice(1, -1), BACKTICK_QUOTE),
                            SINGLE_QUOTE,
                        ) + SINGLE_QUOTE;
                }

                return string;

            case QuoteType.Double:
                if (actualQuoteType === QuoteType.None) {
                    return DOUBLE_QUOTE + QuoteUtils.escapeUnescapedOccurrences(string, DOUBLE_QUOTE) + DOUBLE_QUOTE;
                }

                if (actualQuoteType !== QuoteType.Double) {
                // eslint-disable-next-line max-len
                    return DOUBLE_QUOTE
                        + QuoteUtils.escapeUnescapedOccurrences(
                            QuoteUtils.unescapeSingleEscapedOccurrences(string.slice(1, -1), SINGLE_QUOTE),
                            DOUBLE_QUOTE,
                        ) + DOUBLE_QUOTE;
                }

                return string;

            case QuoteType.Backtick:
                if (actualQuoteType === QuoteType.None) {
                    // eslint-disable-next-line max-len
                    return BACKTICK_QUOTE + QuoteUtils.escapeUnescapedOccurrences(string, BACKTICK_QUOTE) + BACKTICK_QUOTE;
                }

                if (actualQuoteType !== QuoteType.Backtick) {
                // eslint-disable-next-line max-len
                    return BACKTICK_QUOTE
                        + QuoteUtils.escapeUnescapedOccurrences(
                            QuoteUtils.unescapeSingleEscapedOccurrences(string.slice(1, -1), SINGLE_QUOTE),
                            BACKTICK_QUOTE,
                        ) + BACKTICK_QUOTE;
                }

                return string;

            default:
                return string;
        }
    }

    /**
     * Removes bounding quotes from a string, if any
     *
     * @param string Input string
     * @returns String without quotes
     */
    public static removeQuotes(string: string): string {
        if (
            // We should check for string length to avoid false positives
            string.length > 1
            && (string[0] === SINGLE_QUOTE || string[0] === DOUBLE_QUOTE || string[0] === BACKTICK_QUOTE)
            && string[0] === string[string.length - 1]
        ) {
            return string.slice(1, -1);
        }

        return string;
    }

    /**
     * Removes bounding quotes from a string, if any, and unescapes the escaped quotes,
     * like transforming `'abc\'def'` to `abc'def`.
     *
     * @param string Input string
     * @returns String without quotes
     */
    public static removeQuotesAndUnescape(string: string): string {
        if (
            // We should check for string length to avoid false positives
            string.length > 1
            && (string[0] === SINGLE_QUOTE || string[0] === DOUBLE_QUOTE || string[0] === BACKTICK_QUOTE)
            && string[0] === string[string.length - 1]
        ) {
            return QuoteUtils.unescapeSingleEscapedOccurrences(string.slice(1, -1), string[0]);
        }

        return string;
    }

    /**
     * Wraps given `strings` with `quote` (defaults to single quote `'`)
     * and joins them with `separator` (defaults to comma+space `, `).
     *
     * @param strings Strings to quote and join.
     * @param quoteType Quote to use.
     * @param separator Separator to use.
     *
     * @returns String with joined items.
     *
     * @example
     * ['abc', 'def']: strings[]  ->  "'abc', 'def'": string
     */
    public static quoteAndJoinStrings(
        strings: string[],
        quoteType: QuoteType = QuoteType.Single,
        separator = `${COMMA}${SPACE}`,
    ): string {
        return strings
            .map((s) => QuoteUtils.setStringQuoteType(s, quoteType))
            .join(separator);
    }
}
