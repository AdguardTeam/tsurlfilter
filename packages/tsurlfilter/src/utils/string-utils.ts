import {
    CR,
    FF,
    LF,
    SPACE,
} from '../common/constants';

/**
 * Splits the string by the delimiter, ignoring escaped delimiters
 * and without tokenizing.
 * Works for plain strings that don't include string representation of
 * complex entities, e.g $replace modifier values.
 *
 * @param string String to split.
 * @param delimiter Delimiter.
 * @param escapeCharacter Escape character.
 * @param preserveEmptyTokens If true, preserve empty parts.
 * @param shouldUnescape If true, unescape characters.
 *
 * @returns Array of string parts.
 */
export function splitByDelimiterWithEscapeCharacter(
    string: string,
    delimiter: string,
    escapeCharacter: string,
    preserveEmptyTokens: boolean,
    shouldUnescape = true,
): string[] {
    if (!string) {
        return [];
    }

    if (string.startsWith(delimiter)) {
        // eslint-disable-next-line no-param-reassign
        string = string.substring(1);
    }

    let words: string[] = [];

    if (!string.includes(escapeCharacter)) {
        words = string.split(delimiter);
        if (!preserveEmptyTokens) {
            words = words.filter((word) => !!word);
        }

        return words;
    }

    let chars: string[] = [];

    const makeWord = () => {
        const word = chars.join('');
        words.push(word);
        chars = [];
    };

    for (let i = 0; i < string.length; i += 1) {
        const char = string.charAt(i);
        const isLastChar = i === (string.length - 1);
        if (char === delimiter) {
            const isEscapedChar = i > 0 && string[i - 1] === escapeCharacter;
            if (isEscapedChar) {
                if (shouldUnescape) {
                    chars.splice(chars.length - 1, 1);
                }
                chars.push(char);
            } else {
                makeWord();
            }
            if (isLastChar) {
                makeWord();
            }
        } else if (isLastChar) {
            chars.push(char);
            makeWord();
        } else {
            chars.push(char);
        }
    }

    if (!preserveEmptyTokens) {
        words = words.filter((word) => !!word);
    }

    return words;
}

/**
 * Checks if the specified string starts with a substr at the specified index.
 *
 * @param str String to check.
 * @param startIndex Index to start checking from.
 * @param substr Substring to check.
 *
 * @returns Boolean true if it does start.
 */
export function startsAtIndexWith(str: string, startIndex: number, substr: string): boolean {
    if (str.length - startIndex < substr.length) {
        return false;
    }

    for (let i = 0; i < substr.length; i += 1) {
        if (str.charAt(startIndex + i) !== substr.charAt(i)) {
            return false;
        }
    }

    return true;
}

/**
 * Checks if `str` has unquoted `substr`.
 *
 * @param str String to check.
 * @param substr Substring to check.
 *
 * @returns True if str has unquoted substr.
 */
export function hasUnquotedSubstring(str: string, substr: string): boolean {
    const quotes = ['"', "'", '/'];

    if (!str.includes(substr)) {
        return false;
    }

    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    if (indexOfAny(str, quotes) === -1) {
        return true;
    }

    const stack: string[] = [];
    for (let i = 0; i < str.length; i += 1) {
        const cursor = str[i];

        if (stack.length === 0) {
            if (startsAtIndexWith(str, i, substr)) {
                return true;
            }
        }

        if (quotes.indexOf(cursor) >= 0
            && (i === 0 || str[i - 1] !== '\\')) {
            const last = stack.pop();
            if (!last) {
                stack.push(cursor);
            } else if (last !== cursor) {
                stack.push(last);
                stack.push(cursor);
            }
        }
    }

    return false;
}

/**
 * `djb2` hash algorithm.
 *
 * NOTE: This version uses some bit operands to exclude overflow MAX_SAFE_INTEGER
 * (and moreover, exclude overflow 2^32).
 *
 * @see {@link https://gist.github.com/eplawless/52813b1d8ad9af510d85?permalink_comment_id=3367765#gistcomment-3367765}
 *
 * @param str String to get hash.
 *
 * @returns Hash.
 */
export function fastHash(str: string): number {
    if (str.length === 0) {
        return 0;
    }

    let hash = 5381;

    for (let i = 0; i < str.length; i += 1) {
        hash = hash * 33 ^ str.charCodeAt(i);
    }
    return hash >>> 0;
}

/**
 * Look for any symbol from "chars" array starting at "start" index or from the start of the string.
 *
 * @param str   String to search.
 * @param chars Chars to search for.
 * @param start Start index (optional, inclusive).
 *
 * @returns Int Index of the element found or -1 if not.
 */
export function indexOfAny(str: string, chars: string[], start = 0): number {
    if (str.length <= start) {
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
 * Replaces all occurrences of find with replace in str.
 *
 * @param str The string in which to replace all occurrences of the find string.
 * @param find The substring to find in the string.
 * @param replace The substring to replace the find string with.
 *
 * @returns The string with all occurrences of find replaced by replace.
 */
export function replaceAll(str: string, find: string, replace: string): string {
    if (!str) {
        return str;
    }
    return str.split(find).join(replace);
}

/**
 * Checks if arrays are equal.
 *
 * @param left Array.
 * @param right Array.
 *
 * @returns {boolean} True on equality.
 */
export function stringArraysEquals(left: string[] | null, right: string[] | null): boolean {
    if (!left || !right) {
        return !left && !right;
    }

    if (left.length !== right.length) {
        return false;
    }

    for (let i = 0; i < left.length; i += 1) {
        if (left[i] !== right[i]) {
            return false;
        }
    }

    return true;
}

/**
 * Checks if arrays have an intersection.
 *
 * @param left Array.
 * @param right Array.
 *
 * @returns {boolean} True on equality.
 */
export function stringArraysHaveIntersection(left: string[] | null, right: string[] | null): boolean {
    if (!left || !right) {
        return true;
    }

    for (let i = 0; i < left.length; i += 1) {
        if (right.includes(left[i])) {
            return true;
        }
    }

    return false;
}

/**
 * Checks if string contains spaces.
 *
 * @param str String to check.
 *
 * @returns `true` if string contains spaces, `false` otherwise.
 */
export function hasSpaces(str: string): boolean {
    return str.includes(SPACE);
}

/**
 * Check if the given value is a string.
 *
 * @param value Value to check.
 *
 * @returns `true` if value is a string, `false` otherwise.
 */
export function isString(value: unknown): value is string {
    return typeof value === 'string';
}

/**
 * Unescapes the specified character in the string.
 *
 * @param str String to escape.
 * @param char Character to escape.
 *
 * @returns The string with the specified character unescaped.
 */
export function unescapeChar(str: string, char: string): string {
    return str.replace(`\\${char}`, char);
}

/**
 * Finds the next line break index in the string starting from the specified index.
 * Supports LF, CR, FF and CRLF line breaks.
 *
 * @param str String to search in.
 * @param startIndex  Start index. Default is 0.
 *
 * @returns A tuple with the line break index and the line break length.
 * If the line break is not found, returns the string length and 0.
 */
export function findNextLineBreakIndex(str: string, startIndex = 0): [number, number] {
    const { length } = str;
    let offset = startIndex;

    while (offset < length) {
        const char = str[offset];

        if (char === LF || char === FF) {
            return [offset, 1];
        }

        if (char === CR) {
            return str[offset + 1] === LF ? [offset, 2] : [offset, 1];
        }

        offset += 1;
    }

    return [length, 0];
}

/**
 * Finds the next occurrence of a specified character in a string that is not preceded by an escape (`\`).
 *
 * @param str The input string to search within.
 * @param char The character to find in the string.
 * @param [startIndex] The index to start searching from.
 *
 * @returns The index of the next unescaped occurrence of the character, or the length of the string if not found.
 */
export const findNextUnescapedIndex = (str: string, char: string, startIndex = 0): number => {
    let i = str.indexOf(char, startIndex);

    while (i !== -1 && str[i - 1] === '\\') {
        i = str.indexOf(char, i + 1);
    }

    return i === -1 ? str.length : i;
};

/**
 * Determines whether a given Unicode code point corresponds to a numeric digit (0-9).
 *
 * @param codePoint The Unicode code point to check.
 *
 * @returns `true` if the code point represents a numeric character (0-9), otherwise `false`.
 */
export const isNumber = (codePoint: number): boolean => {
    return codePoint >= 48 && codePoint <= 57;
};

/**
 * Determines whether a given Unicode code point corresponds to an alphabetical letter (a-z, A-Z).
 *
 * @param codePoint The Unicode code point to check.
 *
 * @returns `true` if the code point represents an alphabetic character, otherwise `false`.
 */
export const isAlpha = (codePoint: number): boolean => {
    const codePointLower = codePoint | 0x20;
    return codePointLower >= 97 && codePointLower <= 122;
};

/**
 * Determines whether a given Unicode code point corresponds to an alphanumeric character (a-z, A-Z, 0-9).
 *
 * @param codePoint The Unicode code point to check.
 *
 * @returns `true` if the code point represents an alphanumeric character, otherwise `false`.
 */
export const isAlphaNumeric = (codePoint: number): boolean => {
    return isAlpha(codePoint) || isNumber(codePoint);
};
