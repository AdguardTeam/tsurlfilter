/**
 * @file Utility functions for working with quotes
 */

import {
    BACKTICK_QUOTE,
    CLOSE_PARENTHESIS,
    CLOSE_SQUARE_BRACKET,
    COMMA,
    DOUBLE_QUOTE,
    EMPTY,
    ESCAPE_CHARACTER,
    OPEN_PARENTHESIS,
    OPEN_SQUARE_BRACKET,
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
        const quoteType = QuoteUtils.getStringQuoteType(string);

        switch (quoteType) {
            case QuoteType.Single:
                return QuoteUtils.unescapeSingleEscapedOccurrences(
                    string.slice(1, -1),
                    SINGLE_QUOTE,
                );

            case QuoteType.Double:
                return QuoteUtils.unescapeSingleEscapedOccurrences(
                    string.slice(1, -1),
                    DOUBLE_QUOTE,
                );

            case QuoteType.Backtick:
                return QuoteUtils.unescapeSingleEscapedOccurrences(
                    string.slice(1, -1),
                    BACKTICK_QUOTE,
                );

            default:
                return string;
        }
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

    /**
     * Convert `""` to `\"` within strings inside of attribute selectors,
     * because it is not compatible with the standard CSS syntax.
     *
     * @param selector CSS selector string.
     *
     * @returns Escaped CSS selector.
     *
     * @note In the legacy syntax, `""` is used to escape double quotes, but it cannot be used
     * in the standard CSS syntax, so we use conversion functions to handle this.
     * @note This function is intended to be used on whole attribute selector or whole selector strings.
     *
     * @see {@link https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#tag-content}
     * @see {@link https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#wildcard}
     *
     * @example
     * ```ts
     * QuoteUtils.escapeAttributeDoubleQuotes('[attr="value with "" quotes"]');
     * QuoteUtils.escapeAttributeDoubleQuotes('div[attr="value with "" quotes"] > span');
     * ```
     */
    public static escapeAttributeDoubleQuotes(selector: string): string {
        const nestingBlockPairs = new Map<string, string>([
            [OPEN_PARENTHESIS, CLOSE_PARENTHESIS],
            [OPEN_SQUARE_BRACKET, CLOSE_SQUARE_BRACKET],
            [SINGLE_QUOTE, SINGLE_QUOTE],
            [DOUBLE_QUOTE, DOUBLE_QUOTE],
            [BACKTICK_QUOTE, BACKTICK_QUOTE],
        ]);
        const nestingBlockStack: string[] = [];
        const buffer: string[] = [];

        for (let i = 0; i < selector.length; i += 1) {
            const char = selector[i];

            // Check if we are inside of an attribute selector's value
            if (
                // nesting will be 2 levels deep if we are inside of attribute selector's value
                nestingBlockStack.length === 2
                // and the outer block is an attribute selector
                && nestingBlockStack[0] === CLOSE_SQUARE_BRACKET
                // and the inner block is a double quote
                && nestingBlockStack[1] === DOUBLE_QUOTE
            ) {
                // We found `""` inside of attribute selector's value
                if (
                    char === DOUBLE_QUOTE
                    && selector[i + 1] === DOUBLE_QUOTE
                ) {
                    // Convert `""` to `\"`
                    buffer.push(ESCAPE_CHARACTER);
                    buffer.push(DOUBLE_QUOTE);

                    // Skip the next double quote
                    i += 1;

                    continue;
                }

                // Normal character inside of attribute selector's value
                buffer.push(char);
                continue;
            }

            // Handle entering nesting blocks
            if (
                nestingBlockPairs.has(char)
                && selector[i - 1] !== ESCAPE_CHARACTER
            ) {
                nestingBlockStack.push(nestingBlockPairs.get(char)!);
                buffer.push(char);
                continue;
            }

            // Handle exiting nesting blocks
            if (
                nestingBlockStack.length > 0
                && char === nestingBlockStack[nestingBlockStack.length - 1]
                && selector[i - 1] !== ESCAPE_CHARACTER
            ) {
                nestingBlockStack.pop();
                buffer.push(char);
                continue;
            }

            // Normal character
            buffer.push(char);
        }

        return buffer.join(EMPTY);
    }

    /**
     * Convert escaped double quotes `\"` to `""` within strings inside of attribute selectors,
     * because it is not compatible with the standard CSS syntax.
     *
     * @param selector CSS selector string.
     *
     * @returns Unescaped CSS selector.
     *
     * @note In the legacy syntax, `""` is used to escape double quotes, but it cannot be used
     * in the standard CSS syntax, so we use conversion functions to handle this.
     * @note This function is intended to be used on whole attribute selector or whole selector strings.
     *
     * @see {@link https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#tag-content}
     * @see {@link https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#wildcard}
     *
     * @example
     * ```ts
     * QuoteUtils.unescapeAttributeDoubleQuotes('[attr="value with \\" quotes"]');
     * QuoteUtils.unescapeAttributeDoubleQuotes('div[attr="value with \\" quotes"] > span');
     * ```
     */
    public static unescapeAttributeDoubleQuotes(selector: string): string {
        const nestingBlockPairs = new Map<string, string>([
            [OPEN_PARENTHESIS, CLOSE_PARENTHESIS],
            [OPEN_SQUARE_BRACKET, CLOSE_SQUARE_BRACKET],
            [SINGLE_QUOTE, SINGLE_QUOTE],
            [DOUBLE_QUOTE, DOUBLE_QUOTE],
            [BACKTICK_QUOTE, BACKTICK_QUOTE],
        ]);
        const nestingBlockStack: string[] = [];
        const buffer: string[] = [];

        for (let i = 0; i < selector.length; i += 1) {
            const char = selector[i];

            // Check if we are inside of an attribute selector's value
            if (
                // nesting will be 2 levels deep if we are inside of attribute selector's value
                nestingBlockStack.length === 2
                // and the outer block is an attribute selector
                && nestingBlockStack[0] === CLOSE_SQUARE_BRACKET
                // and the inner block is a double quote
                && nestingBlockStack[1] === DOUBLE_QUOTE
            ) {
                // We found `\"` inside of attribute selector's value
                if (
                    char === ESCAPE_CHARACTER
                    && selector[i + 1] === DOUBLE_QUOTE
                ) {
                    // Convert `\"` to `""`
                    buffer.push(DOUBLE_QUOTE);
                    buffer.push(DOUBLE_QUOTE);

                    // Skip the next double quote
                    i += 1;

                    continue;
                }

                // Normal character inside of attribute selector's value
                buffer.push(char);
                continue;
            }

            // Handle entering nesting blocks
            if (
                nestingBlockPairs.has(char)
                && selector[i - 1] !== ESCAPE_CHARACTER
            ) {
                nestingBlockStack.push(nestingBlockPairs.get(char)!);
                buffer.push(char);
                continue;
            }

            // Handle exiting nesting blocks
            if (
                nestingBlockStack.length > 0
                && char === nestingBlockStack[nestingBlockStack.length - 1]
                && selector[i - 1] !== ESCAPE_CHARACTER
            ) {
                nestingBlockStack.pop();
                buffer.push(char);
                continue;
            }

            // Normal character
            buffer.push(char);
        }

        return buffer.join(EMPTY);
    }
}
