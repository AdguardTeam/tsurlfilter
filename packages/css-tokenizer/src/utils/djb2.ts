/* eslint-disable no-bitwise */
/**
 * @file Hashing functions based on the djb2 algorithm
 *
 * @see {@link http://www.cse.yorku.ca/~oz/hash.html}
 * @see {@link https://gist.github.com/eplawless/52813b1d8ad9af510d85?permalink_comment_id=3367765#gistcomment-3367765}
 *
 * @todo If we need it, we can create case-sensitive versions of these functions
 */

/**
 * Make a unique hash from the given array of code points
 *
 * @param arr Reference to the array of code points
 * @param start Start index
 * @param end End index
 *
 * @returns Hash of the given array of code points
 *
 * @note Case-insensitive (we use it just for function names which are case-insensitive)
 */
export function getCodePointsArrayHash(arr: Int32Array, start: number, end: number): number {
    let hash = 5381;

    for (let i = start; i < end; i += 1) {
        hash = hash * 33 ^ (arr[i] | 0x20);
    }

    return hash >>> 0;
}

/**
 * Helper function for making a unique hash from the given string's characters
 *
 * @param str String to hash
 *
 * @returns Hash of the given string's code points
 *
 * @note Case-insensitive (we use it just for function names which are case-insensitive)
 */
export function getStringHash(str: string): number {
    let hash = 5381;

    for (let i = 0; i < str.length; i += 1) {
        hash = hash * 33 ^ (str.charCodeAt(i) | 0x20);
    }

    return hash >>> 0;
}
