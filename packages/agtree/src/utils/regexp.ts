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
 * Maximum quantifier value supported by PCRE2.
 *
 * Converted HTML filtering rules are applied by CoreLibs, which compiles
 * `:contains(/.../)` patterns with PCRE2. PCRE2 rejects a quantifier number
 * greater than 65535 ("quantifier too large" error), while JavaScript
 * regular expressions accept larger values. Length bounds above this limit
 * are split into several fixed-count lookaheads, so the generated pattern
 * stays valid in both engines.
 *
 * @see {@link https://www.pcre.org/current/doc/html/pcre2limits.html}
 */
const PCRE2_MAX_QUANTIFIER = 65535;

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
     * Extracts a regular expression from a `:contains()` argument the same
     * way AdGuard CoreLibs does.
     *
     * CoreLibs does not use a JavaScript regular expression literal scanner
     * for this argument. Its `extract_regex()` function in
     * `filtering/htmlfilter/src/htmlfilter.cpp` (CoreLibs v1.23.2, lines
     * 154-177) works like this:
     *
     * - the argument must be longer than two characters and start with `/`;
     * - every trailing ASCII lowercase letter is removed as a flag, whether
     *   or not it is a flag CoreLibs honors (`i` and `s` only). So in
     *   `/a/bc` the letters `bc` are flags, not part of the pattern;
     * - the last character must be `/`, which is the delimiter. CoreLibs
     *   ignores escapes and character classes, so it takes the last slash,
     *   not the first unescaped slash outside a character class;
     * - the pattern between the leading `/` and the delimiter must not be
     *   empty, otherwise CoreLibs matches the argument as literal text;
     * - CoreLibs strips the trailing lowercase letters without a length
     *   guard. If only lowercase letters follow the leading slash, e.g.
     *   `/ads`, CoreLibs strips every letter, reads the leading slash as the
     *   delimiter, and `--input.len` underflows to `SIZE_MAX`. CoreLibs takes
     *   the PCRE2 branch, but the pattern length is not real. This method
     *   returns `null` for this underflow class because it has no
     *   representable pattern, see
     *   {@link RegExpUtils.isCoreLibsRegexArgument}.
     *
     * Consequences: `///` is the regular expression `/`, while `/a\/` and
     * `/a[b/` are regular expressions with the invalid PCRE2 patterns `a\`
     * and `a[b`, so CoreLibs rejects those rules.
     *
     * This is the `:contains()` argument grammar used by the HTML rule
     * converter, mirroring CoreLibs' `extract_regex()`. The converter is
     * currently the only caller: `HtmlRuleConverter` uses
     * {@link RegExpUtils.isCoreLibsRegexArgument} to detect regexp-like
     * `[tag-content]` values; no HTML filtering engine uses this grammar yet.
     *
     * This method only reports how CoreLibs splits the argument; it does not
     * compile the pattern.
     *
     * @see {@link https://github.com/AdGuardSoftwareLimited/core-libs/blob/v1.23.2/filtering/htmlfilter/src/htmlfilter.cpp#L154-L177}
     *
     * @param argument Argument of the `:contains()` pseudo-class.
     *
     * @returns Pattern and stripped flags, or `null` if the argument is not a
     * normal CoreLibs regular expression. `null` also covers the underflow
     * class. Use {@link RegExpUtils.isCoreLibsRegexArgument} to check whether
     * CoreLibs reads the argument as a regular expression at all.
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

        const end = RegExpUtils.getCoreLibsRegexEnd(argument);

        // CoreLibs can strip all the characters after the leading slash.
        // Then it reads `input.ptr[input.len - 1]` before the argument, which
        // is the leading slash because the argument pointer was advanced by
        // one. The delimiter check passes, `--input.len` underflows to
        // `SIZE_MAX`, and CoreLibs takes the PCRE2 branch with a bogus
        // pattern length. There is no pattern to return, so report `null`
        // and let `isCoreLibsRegexArgument()` detect this case.
        if (end === 1 || argument.charAt(end - 1) !== SLASH) {
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
     * Checks whether CoreLibs reads a `:contains()` argument as a regular
     * expression.
     *
     * This predicate covers the normal CoreLibs form parsed by
     * {@link RegExpUtils.parseCoreLibsRegexArgument} and the `end === 1`
     * underflow class. In the underflow class only ASCII lowercase letters
     * follow the leading slash, e.g. `/ads`. CoreLibs strips every letter,
     * reads the leading slash as the delimiter, underflows the pattern length
     * to `SIZE_MAX`, and takes the PCRE2 branch. The argument is a regular
     * expression for CoreLibs, but the pattern is not representable, so
     * {@link RegExpUtils.parseCoreLibsRegexArgument} returns `null` for it.
     *
     * Use this predicate when the caller only needs to know whether CoreLibs
     * matches the argument as literal text. Use
     * {@link RegExpUtils.parseCoreLibsRegexArgument} when the caller needs the
     * split pattern and flags.
     *
     * @param argument Argument of the `:contains()` pseudo-class.
     *
     * @returns `true` if CoreLibs reads the argument as a regular expression,
     * `false` if CoreLibs matches it as literal text.
     *
     * @example
     * // Returns `true`
     * RegExpUtils.isCoreLibsRegexArgument('/ads');
     *
     * // Returns `false`
     * RegExpUtils.isCoreLibsRegexArgument('/ads/I');
     */
    public static isCoreLibsRegexArgument(argument: string): boolean {
        if (RegExpUtils.parseCoreLibsRegexArgument(argument) !== null) {
            return true;
        }

        if (argument.length <= 2 || !argument.startsWith(SLASH)) {
            return false;
        }

        // `/` followed only by lowercase letters: CoreLibs strips every
        // letter and reads the leading slash as the delimiter. See the method
        // docs and `parseCoreLibsRegexArgument()`.
        return RegExpUtils.getCoreLibsRegexEnd(argument) === 1;
    }

    /**
     * Finds the index after the last character of a `:contains()` argument
     * that CoreLibs keeps before it looks for the closing delimiter.
     *
     * CoreLibs removes every trailing ASCII lowercase letter as a flag. Its
     * loop has no length guard, so the result can be `1`, right after the
     * leading slash. See {@link RegExpUtils.isCoreLibsRegexArgument}.
     *
     * @param argument Argument of the `:contains()` pseudo-class.
     *
     * @returns Index after the last character which is not a stripped flag.
     */
    private static getCoreLibsRegexEnd(argument: string): number {
        let end = argument.length;

        while (end > 1 && LOWERCASE_LETTER_PATTERN.test(argument.charAt(end - 1))) {
            end -= 1;
        }

        return end;
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
     * Creates a length-matching lookahead that asserts the string length is
     * between min and max.
     *
     * When both bounds fit into the PCRE2 quantifier limit, the canonical
     * form `(?=.{min,max}$)` is returned. A bound greater than 65535 is
     * split into fixed-count lookaheads, because PCRE2 rejects larger
     * quantifiers while JavaScript accepts them:
     * - the lower bound is a positive lookahead for exactly `min` characters;
     * - the upper bound is a negative lookahead for exactly `max + 1`
     *   characters.
     *
     * For example, `getLengthLookahead(20000, 150000)` returns
     * `(?=.{20000})(?!(?:.{65535}){2}.{18931})`.
     *
     * @param min Minimum length or `null` for no minimum (default to `0`).
     * @param max Maximum length or `null` for no maximum (default to no maximum).
     *
     * @returns Length-matching lookahead, or several lookaheads concatenated.
     */
    public static getLengthLookahead(min: number | null, max: number | null): string {
        const lowerBound = min ?? 0;

        if (
            lowerBound <= PCRE2_MAX_QUANTIFIER
            && (max === null || max <= PCRE2_MAX_QUANTIFIER)
        ) {
            return `(?=.{${lowerBound},${max ?? ''}}$)`;
        }

        let lookahead = EMPTY;

        if (lowerBound > 0) {
            lookahead += `(?=${RegExpUtils.getExactLengthPattern(lowerBound)})`;
        }

        if (max !== null) {
            lookahead += `(?!${RegExpUtils.getExactLengthPattern(max + 1)})`;
        }

        return lookahead;
    }

    /**
     * Creates a pattern that matches exactly the specified number of
     * characters, using only quantifiers within the PCRE2 limit.
     *
     * The number is decomposed into base-65535 digits. Each nested group
     * repeats the previous unit 65535 times, so every quantifier stays
     * within the limit, e.g. 150001 becomes
     * `(?:.{65535}){2}.{18931}`.
     *
     * @param length Exact number of characters to match.
     *
     * @returns Pattern that matches exactly `length` characters.
     */
    private static getExactLengthPattern(length: number): string {
        if (length <= PCRE2_MAX_QUANTIFIER) {
            return length === 1 ? DOT : `.{${length}}`;
        }

        const parts: string[] = [];
        let unit = DOT;
        let rest = length;

        while (rest > 0) {
            const digit = rest % PCRE2_MAX_QUANTIFIER;

            if (digit > 0) {
                if (unit === DOT) {
                    parts.unshift(digit === 1 ? DOT : `.{${digit}}`);
                } else {
                    parts.unshift(digit === 1 ? unit : `(?:${unit}){${digit}}`);
                }
            }

            // Subtract the digit before dividing: the exact integer quotient
            // keeps the decomposition precise for values close to
            // Number.MAX_SAFE_INTEGER.
            rest = (rest - digit) / PCRE2_MAX_QUANTIFIER;

            if (rest > 0) {
                unit = unit === DOT
                    ? `.{${PCRE2_MAX_QUANTIFIER}}`
                    : `(?:${unit}){${PCRE2_MAX_QUANTIFIER}}`;
            }
        }

        return parts.join(EMPTY);
    }

    /**
     * Creates a length-matching regular expression string:
     * `/^<length-lookahead>.*\/s`, where:
     * - the lookahead ensures the string length is between min and max;
     * - `.*` matches any character, including newlines, due to the `s` flag.
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
        return StringUtils.escapeCharacters(value, SPECIAL_REGEX_SYMBOLS);
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
