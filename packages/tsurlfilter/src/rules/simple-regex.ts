/* eslint-disable prefer-regex-literals */
import {
    findNextUnescapedIndex,
    isAlphaNumeric,
    replaceAll,
    splitByDelimiterWithEscapeCharacter,
} from '../utils/string-utils';

// https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/regexp
// should be escaped . * + ? ^ $ { } ( ) | [ ] / \
// except of * | ^
const specialCharacters = ['.', '+', '?', '$', '{', '}', '(', ')', '[', ']', '/', '\\'];
const reSpecialCharacters = new RegExp(`[${specialCharacters.join('\\')}]`, 'g');
const reSpecialCharactersFull = /[.*+?^${}()|[\]\\]/g;
const reEscapedSpecialCharactersFull = /\\[.*+?^${}()|[\]\\]/g;
const protocolMarker = String.raw`:\/\/`;

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Grammar_and_types#using_special_characters_in_strings
const escapeSequence: { [key: string]: string } = {
    n: '\n',
    r: '\r',
    t: '\t',
    b: '\b',
    f: '\f',
    v: '\v',
};

/**
 * Class with static helper methods for working with basic filtering rules patterns.
 *
 * @see {@link https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#basic-rules}
 *
 * @returns The escaped string.
 */
export class SimpleRegex {
    /**
     * Matching the beginning of an address. With this character you don't
     * have to specify a particular protocol and subdomain in address mask.
     * It means, `||` stands for `http://*.`, `https://*.`, `ws://*.`, `wss://*.` at once.
     */
    public static readonly MASK_START_URL: string = '||';

    /**
     * REGEX_START_URL corresponds to MASK_START_URL.
     */
    public static readonly REGEX_START_URL: string = '^(http|https|ws|wss)://([a-z0-9-_.]+\\.)?';

    /**
     * A pointer to the beginning or the end of address. The value depends on the
     * character placement in the mask. For example, a rule `swf|` corresponds
     * to `http://example.com/annoyingflash.swf`, but not to `http://example.com/swf/index.html`.
     * `|http://example.org` corresponds to `http://example.org`,
     * but not to `http://domain.com?url=http://example.org`.
     */
    public static readonly MASK_PIPE: string = '|';

    /**
     * REGEX_END_STRING corresponds to MASK_PIPE if it is in the end of a pattern.
     */
    public static readonly REGEX_END_STRING: string = '$';

    /**
     * REGEX_START_STRING corresponds to MASK_PIPE if it is in the beginning of a pattern.
     */
    public static readonly REGEX_START_STRING: string = '^';

    /**
     * Separator character mark. Separator character is any character,
     * but a letter, a digit, or one of the following: _ - .
     */
    public static readonly MASK_SEPARATOR: string = '^';

    /**
     * REGEX_SEPARATOR corresponds to MASK_SEPARATOR.
     */
    public static readonly REGEX_SEPARATOR: string = '([^ a-zA-Z0-9.%_-]|$)';

    /**
     * This is a wildcard character. It is used to represent "any set of characters".
     * This can also be an empty string or a string of any length.
     */
    public static readonly MASK_ANY_CHARACTER: string = '*';

    /**
     * Path separator.
     */
    public static readonly MASK_BACKSLASH: string = '/';

    /**
     * REGEX_ANY_CHARACTER corresponds to MASK_ANY_CHARACTER.
     */
    public static readonly REGEX_ANY_CHARACTER: string = '.*';

    /**
     * Enclose regex in two backslashes to mark a regex rule.
     *
     * @see {@link https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#regular-expressions-support}
     */
    public static readonly MASK_REGEX_RULE: string = '/';

    /**
     *  Regex for matching special characters in modifier regex pattern.
     */
    public static readonly reModifierPatternSpecialCharacters = /[[\],\\]/g;

    /**
     * Regex for matching escaped special characters in modifier regex pattern.
     */
    public static readonly reModifierPatternEscapedSpecialCharacters = /\\[[\],\\]/g;

    /**
     * If string starts with exclamation mark "!" we consider it as comment.
     */
    public static readonly MASK_COMMENT = '!';

    /**
     * Min length of rule shortcut
     * This value has been picked as a result of performance experiments.
     */
    public static readonly MIN_SHORTCUT_LENGTH = 3;

    /**
     * Min length of generic rule shortcut.
     */
    public static readonly MIN_GENERIC_RULE_LENGTH = 4;

    /**
     * Regex with basic matching pattern special characters.
     */
    private static readonly rePatternSpecialCharacters: RegExp = new RegExp('[*^|]');

    /**
     * Extracts the shortcut from the rule's pattern.
     * Shortcut is the longest substring of the pattern that does not contain
     * any special characters.
     *
     * Please note, that the shortcut is always lower-case!
     *
     * @param pattern Network rule's pattern.
     *
     * @returns The shortcut or the empty string if we could not extract any.
     */
    public static extractShortcut(pattern: string): string {
        if (pattern.startsWith(this.MASK_REGEX_RULE) && pattern.endsWith(this.MASK_REGEX_RULE)) {
            return this.extractRegexpShortcut(pattern);
        }
        return this.extractBasicShortcut(pattern);
    }

    /**
     * Searches for the longest substring of the pattern that
     * does not contain any special characters: `*`, `^`, `|`.
     *
     * @param pattern Network rule's pattern.
     *
     * @returns The shortcut or the empty string.
     */
    private static extractBasicShortcut(pattern: string): string {
        let longest = '';

        const parts = pattern.split(this.rePatternSpecialCharacters);
        for (const part of parts) {
            if (part.length > longest.length) {
                longest = part;
            }
        }

        return (longest || '').toLowerCase();
    }

    /**
     * Extracts the longest substring from the provided regex pattern that does not
     * contain any special regex symbols or constructs that invalidate it for use
     * as a quick match shortcut.
     * The pattern is expected to be enclosed in forward slashes (e.g., `/example/`),
     * and may optionally contain a protocol marker (`://`),
     * which is ignored to prevent trivial matches like "http".
     *
     * This method discards many complex regex features (e.g., groups, character
     * classes, certain escaped sequences) when forming the shortcut, and always
     * returns the result in lower-case. If no valid substring is found, it returns
     * an empty string.
     *
     * @param pattern The input regex pattern, including the enclosing slashes.
     * For example: `/https?:\\/\\/example\\.com/`.
     *
     * @returns The longest valid substring usable as a shortcut, or an empty string if none is found.
     */
    public static extractRegexpShortcut(pattern: string): string {
        const { length } = pattern;

        if (
            !pattern
            // length should be at least 3: "/x/", "//" does not make sense
            || length < 3
            // regex pattern should start and end with '/'
            || pattern[0] !== '/'
            || pattern[length - 1] !== '/'
        ) {
            return '';
        }

        const protocolIndex = pattern.indexOf(protocolMarker);

        /**
         * `i` is our primary index into the pattern;
         * we skip the initial `/` or jump after the protocol marker `://`.
         */
        let i = protocolIndex !== -1
            ? protocolIndex + protocolMarker.length
            : 1;

        let longestToken = '';
        let longestTokenInGroup = '';
        let currentToken = '';

        /**
         * Resets `currentToken` and updates `longestTokenInGroup` if `currentToken` is longer.
         */
        const resetCurrentToken = () => {
            if (currentToken.length > longestTokenInGroup.length) {
                longestTokenInGroup = currentToken;
            }

            currentToken = '';
        };

        /**
         * Resets `longestTokenInGroup` and updates `longestToken` if `longestTokenInGroup` is longer.
         */
        const resetGroupToken = () => {
            if (longestTokenInGroup.length > longestToken.length) {
                longestToken = longestTokenInGroup;
            }

            longestTokenInGroup = '';
        };

        /**
         * Track parenthesis group nesting.
         */
        let groupBalance = 0;

        /**
         * Skip everything up to the closing parenthesis for the current group
         * (including nested groups).
         * This method moves `i` to the position of the closing parenthesis.
         */
        const ignoreCurrentGroup = () => {
            // Ignoring group means we should drop the current token
            currentToken = '';
            longestTokenInGroup = '';
            const startBalance = groupBalance;
            while (i < length) {
                // If `(` is not escaped, increment group count
                if (pattern[i] === '(' && pattern[i - 1] !== '\\') {
                    groupBalance += 1;
                }

                // If `)` is not escaped, decrement group count
                if (pattern[i] === ')' && pattern[i - 1] !== '\\') {
                    groupBalance -= 1;

                    // Once we return to the level before this group started, stop
                    if (groupBalance < startBalance) {
                        break;
                    }
                }

                i += 1;
            }
        };

        while (i < length) {
            const char = pattern[i];

            // 1) Handle escaped sequences
            if (char === '\\') {
                // Skip the backslash
                i += 1;

                const escaped = pattern[i];

                switch (escaped) {
                    // Ignore predefined character classes: \d, \D, \s, \S, \w, \W
                    case 'd':
                    case 'D':
                    case 's':
                    case 'S':
                    case 'w':
                    case 'W':

                    // Ignore special characters: \t, \r, \n, \v, \f, \b, \0
                    // eslint-disable-next-line no-fallthrough
                    case 't':
                    case 'r':
                    case 'n':
                    case 'v':
                    case 'f':
                    case 'b':
                    case '0':
                        resetCurrentToken();
                        i += 1;
                        continue;

                    // Ignore control characters: \cX — control character X
                    case 'c':
                        resetCurrentToken();
                        // skip 'c' and the following character
                        i += 2;
                        continue;

                    // Ignore \xhh
                    case 'x':
                        resetCurrentToken();
                        // skip 'x' and the following 2 characters
                        i += 3;
                        continue;

                    // Ignore \uhhhh
                    case 'u':
                        resetCurrentToken();
                        // skip 'u' and the following 4 characters
                        i += 5;
                        continue;

                    // Ignore named backreference: \k<...>
                    case 'k':
                        resetCurrentToken();
                        // skip 'k'
                        i += 1;
                        if (pattern[i] === '<') {
                            // Skip until the closing '>'
                            i = findNextUnescapedIndex(pattern, '>', i) + 1;
                        }
                        continue;

                    // Special case: add escaped '.' or '/' to the current token
                    case '.':
                    case '/':
                        currentToken += escaped;
                        i += 1;
                        continue;

                    default:
                        resetCurrentToken();
                        i += 1;
                        continue;
                }
            }

            // 2) Handle "regular" characters (i.e., not after a backslash)
            switch (char) {
                // Ignore custom character classes, like [xyz], [^xyz], [\b], [a-z], etc.
                case '[':
                    resetCurrentToken();
                    i = findNextUnescapedIndex(pattern, ']', i) + 1;
                    continue;

                // Ignore disjunctions (alternations), like a|b|c
                // Note: shortcut should be present in all possible tested strings,
                // this is why we ignore disjunctions
                case '|':
                    ignoreCurrentGroup();
                    continue;

                // Ignore specific quantifiers, like x{n}, x{n,}, x{n,m}
                case '{':
                    resetCurrentToken();
                    i = findNextUnescapedIndex(pattern, '}', i) + 1;
                    continue;

                // Handle group open
                case '(':
                    resetCurrentToken();
                    resetGroupToken();
                    groupBalance += 1;

                    // Skip `(`
                    i += 1;

                    // Ignore negative lookahead: (?!...) and negative lookbehind: (?<!...)
                    // Negative lookbehind and lookahead contain data that should not be present in the tested strings,
                    // this is why we ignore them
                    if (pattern.indexOf('?!', i) === i || pattern.indexOf('?<!', i) === i) {
                        ignoreCurrentGroup();
                    }

                    // Ignore name section from named groups: (?<...>
                    if (pattern.indexOf('?<', i) === i) {
                        // Skip until the closing '>'
                        i = findNextUnescapedIndex(pattern, '>', i + 2) + 1;
                    }
                    continue;

                // Handle group close
                case ')':
                    resetCurrentToken();
                    resetGroupToken();
                    groupBalance -= 1;
                    // Skip `)`
                    i += 1;
                    continue;

                // Handle special regex symbols: . * + ? ^ $ /
                case '.':
                case '*':
                case '+':
                case '?':
                case '^':
                case '$':
                case '/':
                    resetCurrentToken();
                    i += 1;
                    continue;

                default:
                    // For performance, let's check if it's a valid token char
                    // Note: isValidRegexpShortcutChar checks for alphanumeric or
                    // escaped '.' or '/'
                    if (isAlphaNumeric(char.charCodeAt(0))) {
                        currentToken += char;
                    } else {
                        // If it's not a valid char for a shortcut, reset
                        resetCurrentToken();
                    }
                    i += 1;
                    break;
            }
        }

        // Finalize the last token
        resetCurrentToken();
        resetGroupToken();

        return longestToken.toLowerCase();
    }

    /**
     * PatternToRegexp is a helper method for creating regular expressions from the simple
     * wildcard-based syntax which is used in basic filters.
     *
     * @see {@link https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#basic-rules}
     *
     * @param pattern Basic rule pattern.
     *
     * @returns Regular expression.
     */
    public static patternToRegexp(pattern: string): string {
        if (
            pattern === this.MASK_START_URL
            || pattern === this.MASK_PIPE
            || pattern === this.MASK_ANY_CHARACTER
            || pattern === ''
        ) {
            return this.REGEX_ANY_CHARACTER;
        }

        if (pattern.startsWith(this.MASK_REGEX_RULE) && pattern.endsWith(this.MASK_REGEX_RULE)) {
            // This is a regex rule, just remove the regex markers
            return pattern.substring(this.MASK_REGEX_RULE.length, pattern.length - this.MASK_REGEX_RULE.length);
        }

        // Escape special characters except of * | ^
        let regex = pattern.replace(reSpecialCharacters, '\\$&');

        // Now escape "|" characters but avoid escaping them in the special places
        if (regex.startsWith(this.MASK_START_URL)) {
            regex = regex.substring(0, this.MASK_START_URL.length)
                + replaceAll(
                    regex.substring(this.MASK_START_URL.length, regex.length - this.MASK_PIPE.length),
                    this.MASK_PIPE,
                    `\\${this.MASK_PIPE}`,
                )
                + regex.substring(regex.length - this.MASK_PIPE.length);
        } else {
            regex = regex.substring(0, this.MASK_PIPE.length)
                + replaceAll(
                    regex.substring(this.MASK_PIPE.length, regex.length - this.MASK_PIPE.length),
                    this.MASK_PIPE,
                    `\\${this.MASK_PIPE}`,
                )
                + regex.substring(regex.length - this.MASK_PIPE.length);
        }

        // Replace special URL masks
        regex = replaceAll(regex, this.MASK_ANY_CHARACTER, this.REGEX_ANY_CHARACTER);
        regex = replaceAll(regex, this.MASK_SEPARATOR, this.REGEX_SEPARATOR);

        // Replace start URL and pipes
        if (regex.startsWith(this.MASK_START_URL)) {
            regex = this.REGEX_START_URL + regex.substring(this.MASK_START_URL.length);
        } else if (regex.startsWith(this.MASK_PIPE)) {
            regex = this.REGEX_START_STRING + regex.substring(this.MASK_PIPE.length);
        }

        if (regex.endsWith(this.MASK_PIPE)) {
            regex = regex.substring(0, regex.length - this.MASK_PIPE.length) + this.REGEX_END_STRING;
        }

        return regex;
    }

    /**
     * Creates RegExp object from string in '/reg_exp/gi' format.
     *
     * @param str The string to escape.
     *
     * @returns The created RegExp object.
     */
    public static patternFromString(str: string): RegExp {
        const parts = splitByDelimiterWithEscapeCharacter(str, '/', '\\', true);
        let modifiers = (parts[1] || '');
        if (modifiers.indexOf('g') < 0) {
            modifiers += 'g';
        }

        return new RegExp(parts[0], modifiers);
    }

    /**
     * Escapes characters with special meaning inside a regular expression.
     *
     * @param str The string to escape.
     * @param searchPattern Pattern for detecting special characters. Optional.
     *
     * @returns The escaped string.
     */
    public static escapeRegexSpecials(
        str: string,
        searchPattern: string | RegExp = reSpecialCharactersFull,
    ): string {
        return str.replace(searchPattern, '\\$&');
    }

    /**
     * Unescapes characters with special meaning inside a regular expression.
     *
     * @param str The string to unescape.
     * @param searchPattern Pattern for detecting special characters. Optional.
     *
     * @returns The unescaped string.
     */
    public static unescapeRegexSpecials(
        str: string,
        searchPattern: string | RegExp = reEscapedSpecialCharactersFull,
    ): string {
        return str.replace(searchPattern, (match) => match.substring(1));
    }

    /**
     * Check if pattern is Regex.
     *
     * @param str The string to check.
     *
     * @returns True if the string is a regex pattern, false otherwise.
     */
    public static isRegexPattern(str: string): boolean {
        return str.startsWith('/') && str.endsWith('/');
    }

    /**
     * Unescapes special characters in a string.
     *
     * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Grammar_and_types#using_special_characters_in_strings}
     *
     * @param str The string to unescape.
     *
     * @returns The unescaped string.
     */
    public static unescapeSpecials(str: string): string {
        const keys = Object.keys(escapeSequence).join('|');
        const regex = new RegExp(`\\\\(${keys})`, 'g');
        return str.replace(regex, (match, group) => {
            return escapeSequence[group];
        });
    }
}
