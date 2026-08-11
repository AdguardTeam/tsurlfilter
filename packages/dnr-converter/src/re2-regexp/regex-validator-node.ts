import { RE2 } from '@adguard/re2-wasm';

/**
 * Maximum memory in bytes for the regex.
 * This value is lower than 2KB as required by chrome, but it was determined empirically.
 */
const MAX_MEMORY_BYTES = 1979;

/**
 * Check if the regex is supported in Node.js using the `@adguard/re2-wasm` package.
 * This function should only be used in the Node.js environment.
 *
 * @param regexFilter Regex to check.
 *
 * @returns Promise that resolves to true if the regex is supported, and rejects with an error otherwise.
 */
export async function regexValidatorNode(regexFilter: string): Promise<true> {
    // `RE2` only works in the Unicode mode. The `u` flag must be passed to the `RE2` constructor.
    new RE2(regexFilter, 'u', MAX_MEMORY_BYTES);
    return true;
}
