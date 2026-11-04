/**
 * @file Regular expression utilities.
 */

import GlobToRegExp from 'glob-to-regexp';

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
 * Parts of a regular expression literal in the `/pattern/flags` form.
 */
export interface RegexLiteralParts {
    /**
     * Pattern between the delimiters.
     */
    pattern: string;

    /**
     * Flags after the closing delimiter, possibly an empty string.
     */
    flags: string;
}

/**
 * Special RegExp symbols.
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
 * Pattern for an ASCII lowercase letter.
 *
 * CoreLibs strips every trailing lowercase letter of a `:contains()`
 * argument as a regular expression flag, whether or not it is a flag that
 * CoreLibs honors (see {@link RegExpUtils.parseCoreLibsRegexArgument}).
 * `islower()` in the C locale matches the ASCII letters `a`-`z` only.
 */
const LOWERCASE_LETTER_PATTERN = /^[a-z]$/;

/**
 * Utility functions for working with RegExp patterns.
 */
export class RegExpUtils {
    /**
     * Checks whether a string possibly is a RegExp pattern.
     * Flags are not supported.
     *
     * Note: it does not perform a full validation of the pattern,
     * it just checks if the string starts and ends with a slash.
     *
     * @param pattern Pattern to check.
     *
     * @returns `true` if the string is a RegExp pattern, `false` otherwise.
     */
    public static isRegexPattern(pattern: string): boolean {
        const trimmedPattern = pattern.trim();

        // Avoid false positives
        return trimmedPattern.length > REGEX_MARKER.length * 2
            && trimmedPattern.startsWith(REGEX_MARKER)
            && trimmedPattern.endsWith(REGEX_MARKER)
            && trimmedPattern[REGEX_MARKER.length - 2] !== ESCAPE_CHARACTER;
    }

    /**
     * Splits a JavaScript regular expression literal in the `/pattern/flags`
     * form into its pattern and flags.
     *
     * The parser checks only the shape of the literal, not whether the pattern
     * compiles in JavaScript. The literal must have this shape:
     *
     * - it starts with `/`;
     * - a later `/` exists that is not escaped and is not inside a `[...]`
     *   character class. The parser tracks the escape state, so the second
     *   backslash of `\\` does not escape a following `/` or `]`;
     * - the pattern between the delimiters is not empty.
     *
     * The shape check does not compile the pattern on purpose: the caller
     * compiles it and falls back to literal matching if JavaScript rejects
     * the pattern, e.g. `/a++/`, which is valid PCRE2 but invalid JavaScript.
     *
     * This is the JavaScript literal grammar. CoreLibs reads a `:contains()`
     * argument with a different scanner, see
     * {@link RegExpUtils.parseCoreLibsRegexArgument}.
     *
     * @param literal String to parse.
     *
     * @returns Pattern and flags, or `null` if the string is not a regular
     * expression literal.
     *
     * @example
     * // Returns `{ pattern: 'foo.*bar', flags: 'i' }`
     * RegExpUtils.parseRegexLiteral('/foo.*bar/i');
     */
    public static parseRegexLiteral(literal: string): RegexLiteralParts | null {
        if (literal.length < 2 || !literal.startsWith(SLASH)) {
            return null;
        }

        let escaped = false;
        let inCharClass = false;

        for (let i = 1; i < literal.length; i += 1) {
            const char = literal.charAt(i);

            // The previous backslash escapes this character, so it cannot
            // open a character class, close a character class, or close the
            // literal. Check the escape state instead of the previous
            // character alone: in `\\` the second backslash is escaped, so a
            // slash or a bracket that follows it is not escaped.
            if (escaped) {
                escaped = false;
                continue;
            }

            if (char === ESCAPE_CHARACTER) {
                escaped = true;
                continue;
            }

            if (char === OPEN_SQUARE_BRACKET) {
                inCharClass = true;
                continue;
            }

            if (char === CLOSE_SQUARE_BRACKET) {
                inCharClass = false;
                continue;
            }

            if (char === SLASH && !inCharClass) {
                const pattern = literal.slice(1, i);

                // An empty pattern is not a regular expression literal
                if (!pattern) {
                    return null;
                }

                return {
                    pattern,
                    flags: literal.slice(i + 1),
                };
            }
        }

        // No closing slash was found
        return null;
    }

    /**
     * Extracts a regular expression from a `:contains()` argument the same
     * way AdGuard CoreLibs does.
     *
     * CoreLibs does not use a JavaScript regular expression literal scanner
     * for this argument. Its `extract_regex()` function in
     * `filtering/htmlfilter/src/htmlfilter.cpp` works like this:
     *
     * - the argument must be longer than two characters and start with `/`;
     * - every trailing ASCII lowercase letter is removed as a flag, whether
     *   or not it is a flag CoreLibs honors (`i` and `s` only). So in
     *   `/a/bc` the letters `bc` are flags, not part of the pattern;
     * - the last character must be `/`, which is the delimiter. CoreLibs
     *   ignores escapes and character classes, so it takes the last slash,
     *   not the first unescaped slash outside a character class;
     * - the pattern between the leading `/` and the delimiter must not be
     *   empty, otherwise CoreLibs matches the argument as literal text.
     *
     * Consequences: `///` is the regular expression `/`, while `/a\/` and
     * `/a[b/` are regular expressions with the invalid PCRE2 patterns `a\`
     * and `a[b`, so CoreLibs rejects those rules. A JavaScript literal
     * scanner returns `null` for all three.
     *
     * The caller must not compile the returned pattern. This method only
     * reports how CoreLibs splits the argument.
     *
     * @param argument Argument of the `:contains()` pseudo-class.
     *
     * @returns Pattern and stripped flags, or `null` if CoreLibs matches the
     * argument as literal text.
     *
     * @example
     * // Returns `{ pattern: 'ads', flags: '' }`
     * RegExpUtils.parseCoreLibsRegexArgument('/ads/');
     *
     * // Returns `{ pattern: '/', flags: '' }`
     * RegExpUtils.parseCoreLibsRegexArgument('///');
     */
    public static parseCoreLibsRegexArgument(argument: string): RegexLiteralParts | null {
        // CoreLibs requires a pattern and two delimiters at least, so a
        // two-character argument such as `//` is literal text
        if (argument.length <= 2 || !argument.startsWith(SLASH)) {
            return null;
        }

        // Index after the last character which is not a stripped flag. The
        // leading slash is never stripped, so the loop stops at 1. CoreLibs
        // can strip all the characters after the leading slash and then
        // reads the character before the argument, which is `(` for
        // `:contains()` and not a slash, so such an argument is literal text.
        let end = argument.length;

        while (end > 1 && LOWERCASE_LETTER_PATTERN.test(argument.charAt(end - 1))) {
            end -= 1;
        }

        // No closing slash before the stripped flags
        if (end <= 1 || argument.charAt(end - 1) !== SLASH) {
            return null;
        }

        const pattern = argument.slice(1, end - 1);

        // An empty pattern is matched as literal text
        if (!pattern) {
            return null;
        }

        return {
            pattern,
            flags: argument.slice(end),
        };
    }

    /**
     * Checks whether a string is a negated RegExp pattern.
     *
     * @param pattern Pattern to check.
     *
     * @returns `true` if the string is a negated RegExp pattern, `false` otherwise.
     */
    public static isNegatedRegexPattern(pattern: string): boolean {
        if (pattern.startsWith(REGEX_MARKER) && pattern.endsWith(REGEX_MARKER)) {
            const innerPattern = pattern.slice(REGEX_MARKER.length, pattern.length - REGEX_MARKER.length);
            return innerPattern.startsWith(REGEX_NEGATION_PREFIX) && innerPattern.endsWith(REGEX_NEGATION_SUFFIX);
        }

        return pattern.startsWith(REGEX_NEGATION_PREFIX) && pattern.endsWith(REGEX_NEGATION_SUFFIX);
    }

    /**
     * Removes negation from a RegExp pattern.
     *
     * @param pattern RegExp pattern to remove negation from.
     *
     * @returns RegExp pattern without negation.
     */
    public static removeNegationFromRegexPattern(pattern: string): string {
        let result = pattern.trim();
        const slashes = RegExpUtils.isRegexPattern(result);

        if (slashes) {
            result = result.substring(REGEX_MARKER.length, result.length - REGEX_MARKER.length);
        }

        if (result.startsWith(REGEX_NEGATION_PREFIX) && result.endsWith(REGEX_NEGATION_SUFFIX)) {
            result = result.substring(REGEX_NEGATION_PREFIX.length, result.length - REGEX_NEGATION_SUFFIX.length);
        }

        return slashes ? `${REGEX_MARKER}${result}${REGEX_MARKER}` : result;
    }

    /**
     * Negates a RegExp pattern. Technically, this method wraps the pattern in `^((?!` and `).)*$`.
     *
     * RegExp modifiers are not supported.
     *
     * @param pattern Pattern to negate (can be wrapped in slashes or not).
     *
     * @returns Negated RegExp pattern.
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
     * Ensures that a pattern is wrapped in slashes.
     *
     * @param pattern Pattern to ensure slashes for.
     *
     * @returns Pattern with slashes.
     */
    public static ensureSlashes(pattern: string): string {
        let result = pattern;

        if (!result.startsWith(REGEX_MARKER)) {
            result = `${REGEX_MARKER}${result}`;
        }

        if (!result.endsWith(REGEX_MARKER)) {
            result += REGEX_MARKER;
        }

        return result;
    }

    /**
     * Converts a basic adblock rule pattern to a RegExp pattern. Based on
     * https://github.com/AdguardTeam/tsurlfilter/blob/9b26e0b4a0e30b87690bc60f7cf377d112c3085c/packages/tsurlfilter/src/rules/simple-regex.ts#L219.
     *
     * @see {@link https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#basic-rules}
     *
     * @param pattern Pattern to convert.
     *
     * @returns RegExp equivalent of the pattern.
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

    /**
     * Creates a length-matching lookahead: `(?=.{min,max}$)`, which asserts
     * that the string length is between min and max.
     *
     * @param min Minimum length or `null` for no minimum (default to `0`).
     * @param max Maximum length or `null` for no maximum (default to no maximum).
     *
     * @returns Length-matching lookahead.
     */
    public static getLengthLookahead(min: number | null, max: number | null): string {
        return `(?=.{${min ?? 0},${max ?? ''}}$)`;
    }

    /**
     * Creates a length-matching regular expression string: /^(?=.{min,max}$).*\/s
     * Where:
     * - (?=.{min,max}$) is a lookahead that ensures the string length is between min and max
     * - .* matches any character (including newlines, due to the 's' flag).
     *
     * @param min Minimum length or `null` for no minimum (default to `0`).
     * @param max Maximum length or `null` for no maximum (default to no maximum).
     *
     * @returns Length-matching regular expression string.
     */
    public static getLengthRegexp(min: number | null, max: number | null): string {
        return `/^${RegExpUtils.getLengthLookahead(min, max)}.*/s`;
    }

    /**
     * Converts a glob pattern to a regular expression source body with the
     * leading caret anchor removed, e.g. `.*track.*banner.*$` for the glob
     * `*track*banner*`. The result is suitable for embedding into a larger
     * pattern which is already anchored, e.g. as a lookahead: `(?=<body>)`.
     *
     * @param glob Glob pattern to convert.
     *
     * @returns Glob-converted regular expression source body.
     *
     * @example
     * // Returns '.*track.*banner.*$'
     * RegExpUtils.globToRegExpBody('*track*banner*');
     */
    public static globToRegExpBody(glob: string): string {
        return GlobToRegExp(glob).source.replace(/^\^/, EMPTY);
    }

    /**
     * Escapes all special RegExp symbols in the specified string, so that
     * the string can be embedded into a larger regular expression and be
     * matched literally.
     *
     * @param value String to escape.
     *
     * @returns Escaped string.
     *
     * @example
     * // Returns '\$\('http'\)'
     * RegExpUtils.escapeRegexSpecials("$('http')");
     */
    public static escapeRegexSpecials(value: string): string {
        let result = EMPTY;
        for (const ch of value) {
            result += SPECIAL_REGEX_SYMBOLS.has(ch)
                ? ESCAPE_CHARACTER + ch
                : ch;
        }
        return result;
    }

    /**
     * Converts a glob pattern to a RegExp string with slashes and 's' flag.
     *
     * @param glob Glob pattern to convert.
     *
     * @returns RegExp string.
     *
     * @example
     * // Returns '/^foo.*bar$/s'
     * RegExpUtils.globToRegExp('foo*bar');
     */
    public static globToRegExp(glob: string): string {
        return `${REGEX_MARKER + GlobToRegExp(glob).source + REGEX_MARKER}s`;
    }
}
