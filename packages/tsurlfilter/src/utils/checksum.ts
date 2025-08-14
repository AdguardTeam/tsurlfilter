import { createHash } from 'node:crypto';

/**
 * Generates an MD5 hash from a given input string.
 *
 * @param input The input string to be hashed.
 *
 * @returns The MD5 hash of the input string in hexadecimal format.
 *
 * @example
 * const hash = generateMD5Hash('Hello, world!');
 * console.log(hash); // Outputs the MD5 hash of 'Hello, world!'
 */
export function generateMD5Hash(input: string): string {
    return createHash('md5').update(input).digest('hex');
}
