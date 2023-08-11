/**
 * @file Utility functions for working with quotes
 */

import {
    DOUBLE_QUOTE,
    EMPTY,
    ESCAPE_CHARACTER,
    SINGLE_QUOTE,
} from './constants';

/**
 * Possible quote types for scriptlet parameters
 */
export enum QuoteType {
    /**
     * No quotes at all
     */
    None = 'none',

    /**
     * Single quotes (`'`)
     */
    Single = 'single',

    /**
     * Double quotes (`"`)
     */
    Double = 'double',
}

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
            && (string[0] === SINGLE_QUOTE || string[0] === DOUBLE_QUOTE)
            && string[0] === string[string.length - 1]
        ) {
            return string.slice(1, -1);
        }

        return string;
    }
}
