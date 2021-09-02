/**
 * Splits the string by the delimiter, ignoring escaped delimiters.
 *
 * @param str - string to split
 * @param delimiter - delimiter
 * @param escapeCharacter - escape character
 * @param preserveAllTokens - if true, preserve empty parts
 * @return array of string parts
 */
export function splitByDelimiterWithEscapeCharacter(
    str: string,
    delimiter: string,
    escapeCharacter: string,
    preserveAllTokens: boolean,
): string[] {
    let parts: string[] = [];

    if (!str) {
        return parts;
    }

    if (str.startsWith(delimiter)) {
        // eslint-disable-next-line no-param-reassign
        str = str.substring(1);
    }

    if (!str.includes(escapeCharacter)) {
        parts = str.split(delimiter);
        if (!preserveAllTokens) {
            parts = parts.filter((x) => !!x);
        }

        return parts;
    }

    let sb: string[] = [];
    for (let i = 0; i < str.length; i += 1) {
        const c = str.charAt(i);
        if (c === delimiter) {
            if (i > 0 && str.charAt(i - 1) === escapeCharacter) {
                sb.splice(sb.length - 1, 1);
                sb.push(c);
            } else if (preserveAllTokens || sb.length > 0) {
                const part = sb.join('');
                parts.push(part);
                sb = [];
            }
        } else {
            sb.push(c);
        }
    }

    if (preserveAllTokens || sb.length > 0) {
        parts.push(sb.join(''));
    }

    return parts;
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
 * @param str string to get hash
 * @param begin index from
 * @param end index to
 * @return {number} hash
 */
export function fastHashBetween(str: string, begin: number, end: number): number {
    let hash = 5381;
    for (let idx = begin; idx < end; idx += 1) {
        hash = 33 * hash + str.charCodeAt(idx);
    }

    return hash;
}
/**
 * djb2 hash algorithm
 *
 * @param str string to get hash
 * @return {number} hash
 */
export function fastHash(str: string): number {
    if (str === '') {
        return 0;
    }

    const len = str.length;
    return fastHashBetween(str, 0, len);
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
