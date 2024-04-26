import { getRandomNumber } from './number';

// This alphabet uses `A-Za-z0-9_-` symbols.
// The order of characters is optimized for better gzip and brotli compression.
const alphabet = 'useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict';

/**
 * Generates a random string using the specified alphabet.
 * The alphabet consists of `A-Za-z0-9_-` symbols and is optimized for better compression.
 * The generated string has a length between 3 and 30 characters.
 *
 * Inspired by nanoid:
 * @see https://github.com/ai/nanoid/blob/main/non-secure/index.js
 *
 * @returns The randomly generated string.
 */
export function getRandomString(): string {
    let id = '';
    // string size in range from 3 to 30
    let i = 30 - getRandomNumber(28);
    // eslint-disable-next-line no-plusplus
    while (i--) {
        id += alphabet[getRandomNumber(64)];
    }
    return id;
}
