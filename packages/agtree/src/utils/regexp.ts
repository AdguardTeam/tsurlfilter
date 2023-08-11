/**
 * @file Regular expression utilities
 */

import {
    ASTERISK,
    CARET,
    CLOSE_CURLY_BRACKET,
    CLOSE_PARENTHESIS,
    CLOSE_SQUARE_BRACKET,
    DOLLAR_SIGN,
    DOT,
    EMPTY,
    ESCAPE_CHARACTER,
    OPEN_CURLY_BRACKET,
    OPEN_PARENTHESIS,
    OPEN_SQUARE_BRACKET,
    PIPE,
    PLUS,
    QUESTION_MARK,
    REGEX_MARKER,
    SLASH,
} from './constants';
import { StringUtils } from './string';

// Special RegExp constants
export const REGEX_START = CARET; // '^'
export const REGEX_END = DOLLAR_SIGN; // '$'
export const REGEX_ANY_CHARACTERS = DOT + ASTERISK; // '.*'

// Special adblock pattern symbols and their RegExp equivalents
export const ADBLOCK_URL_START = PIPE + PIPE; // '||'
export const ADBLOCK_URL_START_REGEX = '^(http|https|ws|wss)://([a-z0-9-_.]+\\.)?';

export const ADBLOCK_URL_SEPARATOR = CARET; // '^'
export const ADBLOCK_URL_SEPARATOR_REGEX = '([^ a-zA-Z0-9.%_-]|$)';

export const ADBLOCK_WILDCARD = ASTERISK; // '*'
export const ADBLOCK_WILDCARD_REGEX = REGEX_ANY_CHARACTERS;

// Negation wrapper for RegExp patterns
export const REGEX_NEGATION_PREFIX = '^((?!';
export const REGEX_NEGATION_SUFFIX = ').)*$';

/**
 * Special RegExp symbols
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions#special-escape
 */
export const SPECIAL_REGEX_SYMBOLS = new Set([
    ASTERISK,
    CARET,
    CLOSE_CURLY_BRACKET,
    CLOSE_PARENTHESIS,
    CLOSE_SQUARE_BRACKET,
    DOLLAR_SIGN,
    DOT,
    ESCAPE_CHARACTER,
    OPEN_CURLY_BRACKET,
    OPEN_PARENTHESIS,
    OPEN_SQUARE_BRACKET,
    PIPE,
    PLUS,
    QUESTION_MARK,
    SLASH,
]);

/**
 * Utility functions for working with RegExp patterns
 */
export class RegExpUtils {
    /**
     * Checks whether a string is a RegExp pattern.
     * Flags are not supported.
     *
     * @param pattern - Pattern to check
     * @returns `true` if the string is a RegExp pattern, `false` otherwise
     */
    public static isRegexPattern(pattern: string): boolean {
        const trimmedPattern = pattern.trim();

        // Avoid false positives
        if (trimmedPattern.length > REGEX_MARKER.length * 2 && trimmedPattern.startsWith(REGEX_MARKER)) {
            const last = StringUtils.findNextUnescapedCharacter(trimmedPattern, REGEX_MARKER, REGEX_MARKER.length);
            return last === trimmedPattern.length - 1;
        }

        return false;
    }

    /**
     * Negates a RegExp pattern. Technically, this method wraps the pattern in `^((?!` and `).)*$`.
     *
     * RegExp modifiers are not supported.
     *
     * @param pattern Pattern to negate (can be wrapped in slashes or not)
     * @returns Negated RegExp pattern
     */
    public static negateRegexPattern(pattern: string): string {
        let result = pattern.trim();
        let slashes = false;

        // Remove the leading and trailing slashes (/)
        if (RegExpUtils.isRegexPattern(result)) {
            result = result.substring(REGEX_MARKER.length, result.length - REGEX_MARKER.length);
            slashes = true;
        }

        // Only negate the pattern if it's not already negated
        if (!(result.startsWith(REGEX_NEGATION_PREFIX) && result.endsWith(REGEX_NEGATION_SUFFIX))) {
            // Remove leading caret (^)
            if (result.startsWith(REGEX_START)) {
                result = result.substring(REGEX_START.length);
            }

            // Remove trailing dollar sign ($)
            if (result.endsWith(REGEX_END)) {
                result = result.substring(0, result.length - REGEX_END.length);
            }

            // Wrap the pattern in the negation
            result = `${REGEX_NEGATION_PREFIX}${result}${REGEX_NEGATION_SUFFIX}`;
        }

        // Add the leading and trailing slashes back if they were there
        if (slashes) {
            result = `${REGEX_MARKER}${result}${REGEX_MARKER}`;
        }

        return result;
    }

    /**
     * Converts a basic adblock rule pattern to a RegExp pattern. Based on
     * https://github.com/AdguardTeam/tsurlfilter/blob/9b26e0b4a0e30b87690bc60f7cf377d112c3085c/packages/tsurlfilter/src/rules/simple-regex.ts#L219
     *
     * @param pattern Pattern to convert
     * @returns RegExp equivalent of the pattern
     * @see {@link https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#basic-rules}
     */
    public static patternToRegexp(pattern: string): string {
        const trimmed = pattern.trim();

        // Return regex for any character sequence if the pattern is just |, ||, * or empty
        if (trimmed === ADBLOCK_URL_START
            || trimmed === PIPE
            || trimmed === ADBLOCK_WILDCARD
            || trimmed === EMPTY) {
            return REGEX_ANY_CHARACTERS;
        }

        // If the pattern is already a RegExp, just return it, but remove the leading and trailing slashes
        if (RegExpUtils.isRegexPattern(pattern)) {
            return pattern.substring(REGEX_MARKER.length, pattern.length - REGEX_MARKER.length);
        }

        let result = EMPTY;
        let offset = 0;
        let len = trimmed.length;

        // Handle leading pipes
        if (trimmed[0] === PIPE) {
            if (trimmed[1] === PIPE) {
                // Replace adblock url start (||) with its RegExp equivalent
                result += ADBLOCK_URL_START_REGEX;
                offset = ADBLOCK_URL_START.length;
            } else {
                // Replace single pipe (|) with the RegExp start symbol (^)
                result += REGEX_START;
                offset = REGEX_START.length;
            }
        }

        // Handle trailing pipes
        let trailingPipe = false;
        if (trimmed.endsWith(PIPE)) {
            trailingPipe = true;
            len -= PIPE.length;
        }

        // Handle the rest of the pattern, if any
        for (; offset < len; offset += 1) {
            if (trimmed[offset] === ADBLOCK_WILDCARD) {
                // Replace adblock wildcard (*) with its RegExp equivalent
                result += ADBLOCK_WILDCARD_REGEX;
            } else if (trimmed[offset] === ADBLOCK_URL_SEPARATOR) {
                // Replace adblock url separator (^) with its RegExp equivalent
                result += ADBLOCK_URL_SEPARATOR_REGEX;
            } else if (SPECIAL_REGEX_SYMBOLS.has(trimmed[offset])) {
                // Escape special RegExp symbols (we handled pipe (|) and asterisk (*) already)
                result += ESCAPE_CHARACTER + trimmed[offset];
            } else {
                // Just add any other character
                result += trimmed[offset];
            }
        }

        // Handle trailing pipes
        if (trailingPipe) {
            // Replace trailing pipe (|) with the RegExp end symbol ($)
            result += REGEX_END;
        }

        return result;
    }
}
