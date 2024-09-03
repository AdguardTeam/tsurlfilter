/**
 * Splits the string by the delimiter, ignoring escaped delimiters
 * and without tokenizing.
 * Works for plain strings that don't include string representation of
 * complex entities, e.g $replace modifier values.
 *
 * @param string - string to split
 * @param delimiter - delimiter
 * @param escapeCharacter - escape character
 * @param preserveEmptyTokens - if true, preserve empty parts
 * @param shouldUnescape - if true, unescape characters
 * @return array of string parts
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
 * @param str - String to check
 * @param startIndex - Index to start checking from
 * @param substr - Substring to check
 * @return boolean true if it does start
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
 * Checks if str has unquoted substr
 *
 * @param str
 * @param substr
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
 * djb2 hash algorithm
 *
 * NOTE: This version uses some bit operands to exclude overflow MAX_SAFE_INTEGER
 * (and moreover, exclude overflow 2^32).
 *
 * @see {@link https://gist.github.com/eplawless/52813b1d8ad9af510d85?permalink_comment_id=3367765#gistcomment-3367765}
 *
 * @param str string to get hash
 * @return {number} hash
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
 * Look for any symbol from "chars" array starting at "start" index or from the start of the string
 *
 * @param str   String to search
 * @param chars Chars to search for
 * @param start Start index (optional, inclusive)
 * @return int Index of the element found or -1 if not
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
 * Replaces all occurences of find with replace in str
 *
 * @param str
 * @param find
 * @param replace
 */
export function replaceAll(str: string, find: string, replace: string): string {
    if (!str) {
        return str;
    }
    return str.split(find).join(replace);
}

/**
 * Checks if arrays are equal
 *
 * @param left array
 * @param right array
 * @return {boolean} true on equality
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
 * Checks if arrays have an intersection
 *
 * @param left array
 * @param right array
 * @return {boolean} true on equality
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
