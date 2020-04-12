/**
 * Html rule wildcard
 */
export class Wildcard {
    regexp;

    shortcut;

    constructor(pattern) {
        this.regexp = new RegExp(Wildcard.wildcardToRegex(pattern), 'i');
        this.shortcut = Wildcard.extractShortcut(pattern);
    }

    static replaceAll(str, find, replace) {
        if (!str) {
            return str;
        }
        return str.split(find).join(replace);
    }

    /**
     * Look for any symbol from "chars" array starting at "start" index or from the start of the string
     *
     * @param str   String to search
     * @param chars Chars to search for
     * @param start Start index (optional, inclusive)
     * @return int Index of the element found or null
     */
    static indexOfAny(str, chars, start) {
        // eslint-disable-next-line no-param-reassign
        start = start || 0;

        if (typeof str === 'string' && str.length <= start) {
            return -1;
        }

        for (let i = start; i < str.length; i += 1) {
            const c = str.charAt(i);
            if (chars.indexOf(c) > -1) {
                return i;
            }
        }

        return -1;
    }

    /**
     * Converts wildcard to regular expression
     *
     * @param pattern The wildcard pattern to convert
     * @return string A regex equivalent of the given wildcard
     */
    static wildcardToRegex(pattern) {
        const specials = [
            '\\', '*', '+', '?', '|', '{', '}', '[', ']', '(', ')', '^', '$', '.', '#',
        ];
        const specialsRegex = new RegExp(`[${specials.join('\\')}]`, 'g');

        let result = pattern.replace(specialsRegex, '\\$&');

        result = Wildcard.replaceAll(result, '\\*', '[\\s\\S]*');
        result = Wildcard.replaceAll(result, '\\?', '.');

        return `^${result}$`;
    }

    /**
     * Extracts longest string that does not contain * or ? symbols.
     *
     * @param pattern Wildcard pattern
     * @return Longest string without special symbols
     */
    static extractShortcut(pattern) {
        const wildcardChars = ['*', '?'];
        let startIndex = 0;
        let endIndex = Wildcard.indexOfAny(pattern, wildcardChars);

        if (endIndex < 0) {
            return pattern.toLowerCase();
        }

        let shortcut = endIndex === startIndex ? '' : pattern.substring(startIndex, endIndex - startIndex);

        while (endIndex >= 0) {
            startIndex = startIndex + endIndex + 1;
            if (pattern.length <= startIndex) {
                break;
            }

            endIndex = Wildcard.indexOfAny(pattern.substring(startIndex), wildcardChars);
            // eslint-disable-next-line max-len
            const tmpShortcut = endIndex < 0 ? pattern.substring(startIndex) : pattern.substring(startIndex, endIndex + startIndex);

            if (tmpShortcut.length > shortcut.length) {
                shortcut = tmpShortcut;
            }
        }

        return shortcut.toLowerCase();
    }

    /**
     * Returns 'true' if input text is matching wildcard.
     * This method first checking shortcut -- if shortcut exists in input string -- than it checks regexp.
     *
     * @param input Input string
     * @return boolean if input string matches wildcard
     */
    matches(input) {
        if (!input) {
            return false;
        }

        if (input.toLowerCase().indexOf(this.shortcut) < 0) {
            return false;
        }

        return this.regexp.test(input);
    }
}
