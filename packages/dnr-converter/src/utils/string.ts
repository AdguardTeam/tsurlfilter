import punycode from 'punycode/punycode.js';

import { MASK_REGEX_RULE, SPACE_CHARACTER } from '../constants';

import { getErrorMessage } from './error';

/**
 * `djb2` hash algorithm.
 *
 * NOTE: This version uses some bit operands to exclude overflow MAX_SAFE_INTEGER (and moreover, exclude overflow 2^32).
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

    // A magic constant that gives good distribution.
    let hash = 5381;

    for (let i = 0; i < str.length; i += 1) {
        hash = hash * 33 ^ str.charCodeAt(i);
    }
    return hash >>> 0;
}

/**
 * `djb2` hash algorithm with sign bit masked off to fit 31 bits.
 *
 * @param str String to get hash.
 *
 * @returns Hash from 0 to 2^31-1.
 */
export function fastHash31(str: string): number {
    // Mask off sign bit to keep value in range [0, ..., 2^31‑1].
    return fastHash(str) & 0x7fffffff;
}

/**
 * Checks if the string contains only ASCII characters.
 *
 * @param str String to test.
 *
 * @returns True if string contains only ASCII characters.
 */
export function isASCII(str: string): boolean {
    // eslint-disable-next-line no-control-regex
    return /^[\x00-\x7F]+$/.test(str);
}

/**
 * Converts to ASCII characters only if `str` contains non-ASCII characters.
 *
 * @param str String to convert.
 *
 * @returns A transformed string containing only ASCII characters or
 * the original string.
 *
 * @throws Error if conversion into ASCII fails.
 */
export function prepareASCII(str: string): string {
    let res = str;

    try {
        if (!isASCII(res)) {
            // for cyrillic domains we need to convert them by isASCII()
            res = punycode.toASCII(res);
        }
        // after toASCII() some characters can be still non-ASCII
        // e.g. `abc“@` with non-ASCII `“`
        if (!isASCII(res)) {
            res = punycode.encode(res);
        }
    } catch (e: unknown) {
        throw new Error(`Error converting to ASCII: "${str}" due to ${getErrorMessage(e)}`);
    }

    return res;
}

/**
 * Converts a list of strings into strings containing only ASCII characters.
 *
 * @param strings List of strings.
 *
 * @returns List of string containing only ASCII characters.
 */
export function toASCII(strings: string[]): string[] {
    return strings.map(prepareASCII);
}

/**
 * Removes slashes from the beginning and end of the string.
 *
 * @param str String to remove slashes.
 *
 * @returns String without slashes.
 */
export function removeSlashes(str: string): string {
    if (str.startsWith(MASK_REGEX_RULE) && str.endsWith(MASK_REGEX_RULE)) {
        return str.substring(1, str.length - 1);
    }
    return str;
}

/**
 * Check if pattern is Regex.
 *
 * @param str The string to check.
 *
 * @returns True if the string is a regex pattern, false otherwise.
 */
export function isRegexPattern(str: string): boolean {
    return str.startsWith(MASK_REGEX_RULE) && str.endsWith(MASK_REGEX_RULE);
}

/**
 * Checks if string contains spaces.
 *
 * @param str String to check.
 *
 * @returns `true` if string contains spaces, `false` otherwise.
 */
export function hasSpaces(str: string): boolean {
    return str.includes(SPACE_CHARACTER);
}
