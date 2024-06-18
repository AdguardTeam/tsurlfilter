import { RE2 } from '@adguard/re2-wasm';

/**
 * Maximum memory in bytes for the regex.
 * This value is lower than 2MB as required by chrome, but it was determined empirically.
 */
const MAX_MEMORY_BYTES = 1990;

/**
 * Check if the regex is supported in Node.js using the @adguard/re2-wasm package.
 * This function should only be used in the Node.js environment.
 *
 * @param regexFilter Regex to check.
 * @returns True if regex is supported.
 * @throws Error if the regex is not supported.
 */
export const regexValidatorNode = async (regexFilter: string): Promise<boolean> => {
    new RE2(regexFilter, 'u', MAX_MEMORY_BYTES);
    return true;
};
