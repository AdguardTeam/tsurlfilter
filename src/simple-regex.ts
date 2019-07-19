// https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/regexp
// should be escaped . * + ? ^ $ { } ( ) | [ ] / \
// except of * | ^
const specialCharacters = ['.', '+', '?', '$', '{', '}', '(', ')', '[', ']', '/', '\\']
const reSpecialCharacters = new RegExp('[' + specialCharacters.join('\\') + ']', 'g')

/**
 * Replaces all occurencies of a string "find" with "replace" str;
 */
const replaceAll = function(str: string, find: string, replace: string): string {
    if (!str) {
        return str
    }
    return str.split(find).join(replace)
}

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
    public static readonly MASK_START_URL: string = '||'

    /**
     * REGEX_START_URL corresponds to MASK_START_URL
     */
    public static readonly REGEX_START_URL: string = '^(http|https|ws|wss)://([a-z0-9-_.]+\\.)?'

    /**
     * A pointer to the beginning or the end of address. The value depends on the
     * character placement in the mask. For example, a rule swf| corresponds
     * to http://example.com/annoyingflash.swf , but not to http://example.com/swf/index.html.
     * |http://example.org corresponds to http://example.org, but not to http://domain.com?url=http://example.org.
     */
    public static readonly MASK_PIPE: string = '|'

    /**
     * REGEX_END_STRING corresponds to MASK_PIPE if it is in the end of a pattern.
     */
    public static readonly REGEX_END_STRING: string = '$'

    /**
     * REGEX_START_STRING corresponds to MASK_PIPE if it is in the beginning of a pattern.
     */
    public static readonly REGEX_START_STRING: string = '^'

    /**
     * Separator character mark. Separator character is any character,
     * but a letter, a digit, or one of the following: _ - .
     */
    public static readonly MASK_SEPARATOR: string = '^'

    /**
     * REGEX_SEPARATOR corresponds to MASK_SEPARATOR
     */
    public static readonly REGEX_SEPARATOR: string = '([^ a-zA-Z0-9.%]|$)'

    /**
     * This is a wildcard character. It is used to represent "any set of characters".
     * This can also be an empty string or a string of any length.
     */
    public static readonly MASK_ANY_CHARACTER: string = '*'

    /**
     * REGEX_ANY_CHARACTER corresponds to MASK_ANY_CHARACTER.
     */
    public static readonly REGEX_ANY_CHARACTER: string = '.*'

    /**
     * patternToRegexp is a helper method for creating regular expressions from the simple
     * wildcard-based syntax which is used in basic filters:
     * https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#basic-rules
     *
     * @param pattern basic rule pattern
     * @returns regular expression
     */
    static patternToRegexp(pattern: string): string {
        if (
            pattern === this.MASK_START_URL ||
            pattern === this.MASK_PIPE ||
            pattern === this.MASK_ANY_CHARACTER ||
            pattern === ''
        ) {
            return this.REGEX_ANY_CHARACTER
        }

        if (pattern.startsWith('/') && pattern.endsWith('/')) {
            // This is a regex rule, just remove the regex markers
            return pattern.substring(1, pattern.length - 1)
        }

        // Escape special characters except of * | ^
        let regex = pattern.replace(reSpecialCharacters, '\\$&')

        // Now escape "|" characters but avoid escaping them in the special places
        if (regex.startsWith(this.MASK_START_URL)) {
            regex =
                regex.substring(0, this.MASK_START_URL.length) +
                replaceAll(
                    regex.substring(
                        this.MASK_START_URL.length,
                        regex.length - this.MASK_PIPE.length
                    ),
                    '|',
                    '\\|'
                ) +
                regex.substring(regex.length - this.MASK_PIPE.length)
        } else {
            regex =
                regex.substring(0, this.MASK_PIPE.length) +
                replaceAll(
                    regex.substring(this.MASK_PIPE.length, regex.length - this.MASK_PIPE.length),
                    this.MASK_PIPE,
                    '\\' + this.MASK_PIPE
                ) +
                regex.substring(regex.length - this.MASK_PIPE.length)
        }

        // Replace special URL masks
        regex = replaceAll(regex, this.MASK_ANY_CHARACTER, this.REGEX_ANY_CHARACTER)
        regex = replaceAll(regex, this.MASK_SEPARATOR, this.REGEX_SEPARATOR)

        // Replace start URL and pipes
        if (regex.startsWith(this.MASK_START_URL)) {
            regex = this.REGEX_START_URL + regex.substring(this.MASK_START_URL.length)
        } else if (regex.startsWith(this.MASK_PIPE)) {
            regex = this.REGEX_START_STRING + regex.substring(this.MASK_PIPE.length)
        }

        if (regex.endsWith(this.MASK_PIPE)) {
            regex = regex.substring(0, regex.length - this.MASK_PIPE.length) + this.REGEX_END_STRING
        }

        return regex
    }
}
