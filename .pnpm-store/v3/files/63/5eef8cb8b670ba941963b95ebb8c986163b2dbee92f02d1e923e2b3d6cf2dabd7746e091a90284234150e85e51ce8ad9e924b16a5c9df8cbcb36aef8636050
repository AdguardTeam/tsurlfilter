import { replaceAll, indexOfAny } from '../../utils/utils';

/**
 * Html rule wildcard
 */
export class Wildcard {
    private readonly regexp: RegExp;

    private readonly shortcut: string;

    /**
     * Constructor
     *
     * @param pattern
     */
    constructor(pattern: string) {
        this.regexp = new RegExp(Wildcard.wildcardToRegex(pattern), 'i');
        this.shortcut = Wildcard.extractShortcut(pattern);
    }

    /**
     * Returns 'true' if input text is matching wildcard.
     * This method first checking shortcut -- if shortcut exists in input string -- than it checks regexp.
     *
     * @param input Input string
     * @return boolean if input string matches wildcard
     */
    public matches(input: string): boolean {
        if (!input) {
            return false;
        }

        if (input.toLowerCase().indexOf(this.shortcut) < 0) {
            return false;
        }

        return this.regexp.test(input);
    }

    /**
     * Converts wildcard to regular expression
     *
     * @param pattern The wildcard pattern to convert
     * @return string A regex equivalent of the given wildcard
     */
    private static wildcardToRegex(pattern: string): string {
        const specials = [
            '\\', '*', '+', '?', '|', '{', '}', '[', ']', '(', ')', '^', '$', '.', '#',
        ];
        const specialsRegex = new RegExp(`[${specials.join('\\')}]`, 'g');

        let result = pattern.replace(specialsRegex, '\\$&');

        result = replaceAll(result, '\\*', '[\\s\\S]*');
        result = replaceAll(result, '\\?', '.');

        return `^${result}$`;
    }

    /**
     * Extracts longest string that does not contain * or ? symbols.
     *
     * @param pattern Wildcard pattern
     * @return Longest string without special symbols
     */
    private static extractShortcut(pattern: string): string {
        const wildcardChars = ['*', '?'];
        let startIndex = 0;
        let endIndex = indexOfAny(pattern, wildcardChars);

        if (endIndex < 0) {
            return pattern.toLowerCase();
        }

        let shortcut = endIndex === startIndex ? '' : pattern.substring(startIndex, endIndex - startIndex);

        while (endIndex >= 0) {
            startIndex = startIndex + endIndex + 1;
            if (pattern.length <= startIndex) {
                break;
            }

            endIndex = indexOfAny(pattern.substring(startIndex), wildcardChars);
            // eslint-disable-next-line max-len
            const tmpShortcut = endIndex < 0 ? pattern.substring(startIndex) : pattern.substring(startIndex, endIndex + startIndex);

            if (tmpShortcut.length > shortcut.length) {
                shortcut = tmpShortcut;
            }
        }

        return shortcut.toLowerCase();
    }
}
