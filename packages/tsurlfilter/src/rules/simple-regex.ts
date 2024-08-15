/* eslint-disable prefer-regex-literals */
import { replaceAll, splitByDelimiterWithEscapeCharacter } from '../utils/string-utils';

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
 * https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#basic-rules
 */
export class SimpleRegex {
    /**
     * Matching the beginning of an address. With this character you don't
     * have to specify a particular protocol and subdomain in address mask.
     * It means, || stands for http://*., https://*., ws://*., wss://*. at once.
     */
    public static readonly MASK_START_URL: string = '||';

    /**
     * REGEX_START_URL corresponds to MASK_START_URL
     */
    public static readonly REGEX_START_URL: string = '^(http|https|ws|wss)://([a-z0-9-_.]+\\.)?';

    /**
     * A pointer to the beginning or the end of address. The value depends on the
     * character placement in the mask. For example, a rule swf| corresponds
     * to http://example.com/annoyingflash.swf , but not to http://example.com/swf/index.html.
     * |http://example.org corresponds to http://example.org,
     * but not to http://domain.com?url=http://example.org.
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
     * REGEX_SEPARATOR corresponds to MASK_SEPARATOR
     */
    public static readonly REGEX_SEPARATOR: string = '([^ a-zA-Z0-9.%_-]|$)';

    /**
     * This is a wildcard character. It is used to represent "any set of characters".
     * This can also be an empty string or a string of any length.
     */
    public static readonly MASK_ANY_CHARACTER: string = '*';

    /**
     * Path separator
     */
    public static readonly MASK_BACKSLASH: string = '/';

    /**
     * REGEX_ANY_CHARACTER corresponds to MASK_ANY_CHARACTER.
     */
    public static readonly REGEX_ANY_CHARACTER: string = '.*';

    /**
     * Enclose regex in two backslashes to mark a regex rule:
     * https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#regular-expressions-support
     */
    public static readonly MASK_REGEX_RULE: string = '/';

    /**
     *  Regex for matching special characters in modifier regex pattern
     */
    public static readonly reModifierPatternSpecialCharacters = /[[\],\\]/g;

    /**
      *  Regex for matching escaped special characters in modifier regex pattern
      */
    public static readonly reModifierPatternEscapedSpecialCharacters = /\\[[\],\\]/g;

    /**
     * If string starts with exclamation mark "!" we consider it as comment
     */
    public static readonly MASK_COMMENT = '!';

    /**
     * Min length of rule shortcut
     * This value has been picked as a result of performance experiments
     */
    public static readonly MIN_SHORTCUT_LENGTH = 3;

    /**
     * Min length of generic rule shortcut
     */
    public static readonly MIN_GENERIC_RULE_LENGTH = 4;

    /** Regex with basic matching pattern special characters */
    private static readonly rePatternSpecialCharacters: RegExp = new RegExp('[*^|]');

    /**
     * Checks if char is valid for regexp shortcut – is alphanumeric or escaped period or forward slash
     *
     * @param str string
     * @param i index of char
     * @returns  true if char is valid for regexp shortcut
     */
    private static isValidRegexpShortcutChar = (str: string, i: number) => {
        const charCode = str.charCodeAt(i);
        if (SimpleRegex.isAlphaNumericChar(charCode)) {
            return true;
        }

        // Escaped period or escaped forward slash are allowed in regexp shortcut
        if (i > 0 && str[i - 1] === '\\') {
            if (charCode === 46 || charCode === 47) {
                return true;
            }
        }

        return false;
    };

    /**
     * Checks if char is alpha-numeric
     * @param charCode - char code
     * @returns true if char is alpha-numeric
     */
    private static isAlphaNumericChar = (charCode: number) => {
        return (charCode > 47 && charCode < 58) // numeric (0-9)
                || (charCode > 64 && charCode < 91) // upper alpha (A-Z)
                || (charCode > 96 && charCode < 123); // lower alpha (a-z)
    };

    /**
     * Extracts the shortcut from the rule's pattern.
     * Shortcut is the longest substring of the pattern that does not contain
     * any special characters.
     *
     * Please note, that the shortcut is always lower-case!
     *
     * @param pattern - network rule's pattern.
     * @returns the shortcut or the empty string if we could not extract any.
     */
    static extractShortcut(pattern: string): string {
        if (pattern.startsWith(this.MASK_REGEX_RULE) && pattern.endsWith(this.MASK_REGEX_RULE)) {
            return this.extractRegexpShortcut(pattern);
        }
        return this.extractBasicShortcut(pattern);
    }

    /**
     * Searches for the longest substring of the pattern that
     * does not contain any special characters: *,^,|.
     *
     * @param pattern - network rule's pattern.
     * @returns the shortcut or the empty string
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
     * Searches for a shortcut inside of a regexp pattern.
     * Shortcut in this case is a longest string with no REGEX special characters.
     * Also, we discard complicated regexps right away.
     *
     * @param pattern - network rule's pattern (regexp).
     * @returns the shortcut or the empty string
     */
    private static extractRegexpShortcut(pattern: string): string {
        let reText = pattern.substring(this.MASK_REGEX_RULE.length, pattern.length - this.MASK_REGEX_RULE.length);

        if (reText.length === 0) {
            // The rule is too short, doing nothing
            return '';
        }

        if (reText.indexOf('?') >= 0) {
            // Do not mess with complex expressions which use lookahead
            // And with those using ? special character
            // https://github.com/AdguardTeam/AdguardBrowserExtension/issues/978
            return '';
        }

        // Remove protocol part to avoid useless shortcuts like "http"
        const protocolIndex = reText.indexOf(protocolMarker);
        if (protocolIndex > -1) {
            reText = reText.substring(protocolIndex + protocolMarker.length);
        }

        let currentLongest = '';
        let token = '';

        for (let i = 0; i < reText.length; i += 1) {
            const char = reText[i];
            if (char === '\\') {
                // Don't break token on escapes
                continue;
            }

            if (SimpleRegex.isValidRegexpShortcutChar(reText, i)) {
                token += char;
                if (i !== reText.length - 1) {
                    continue;
                }
            }

            if (token.length > currentLongest.length) {
                currentLongest = token;
            }
            token = '';
        }

        return currentLongest.toLowerCase();
    }

    /**
     * patternToRegexp is a helper method for creating regular expressions from the simple
     * wildcard-based syntax which is used in basic filters:
     * https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#basic-rules
     *
     * @param pattern - basic rule pattern
     * @returns regular expression
     */
    static patternToRegexp(pattern: string): string {
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
     * Creates RegExp object from string in '/reg_exp/gi' format
     *
     * @param str
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
     * @param str
     * @param searchPattern - Pattern for detecting special characters. Optional.
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
     * @param str
     * @param searchPattern - Pattern for detecting special characters. Optional.
     */
    public static unescapeRegexSpecials(
        str: string,
        searchPattern: string | RegExp = reEscapedSpecialCharactersFull,
    ): string {
        return str.replace(searchPattern, (match) => match.substring(1));
    }

    /**
     * Check if pattern is Regex
     */
    public static isRegexPattern(str: string): boolean {
        return str.startsWith('/') && str.endsWith('/');
    }

    /**
     * Unescapes special characters in a string
     * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Grammar_and_types#using_special_characters_in_strings
     */
    public static unescapeSpecials(str: string): string {
        const keys = Object.keys(escapeSequence).join('|');
        const regex = new RegExp(`\\\\(${keys})`, 'g');
        return str.replace(regex, (match, group) => {
            return escapeSequence[group];
        });
    }
}
