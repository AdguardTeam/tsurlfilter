import { getRandomNumber } from './number';

// This alphabet uses `A-Za-z0-9_-` symbols.
// The order of characters is optimized for better gzip and brotli compression.
const alphabet = 'useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict';

/**
 * Generates a random string using the specified alphabet.
 * The alphabet consists of `A-Za-z0-9_-` symbols and is optimized for better compression.
 * The generated string has a length between the specified min and max parameters.
 *
 * Inspired by nanoid, @see {@link https://github.com/ai/nanoid/blob/main/non-secure/index.js}.
 *
 * @param min The minimum length of the generated string.
 * @param max The maximum length of the generated string.
 *
 * @returns The randomly generated string.
 */
export function getRandomString(min: number = 3, max: number = 30): string {
    let id = '';
    // string size in range from min to max
    let i = min + getRandomNumber(max - min + 1);
    // eslint-disable-next-line no-plusplus
    while (i--) {
        id += alphabet[getRandomNumber(64)];
    }
    return id;
}
