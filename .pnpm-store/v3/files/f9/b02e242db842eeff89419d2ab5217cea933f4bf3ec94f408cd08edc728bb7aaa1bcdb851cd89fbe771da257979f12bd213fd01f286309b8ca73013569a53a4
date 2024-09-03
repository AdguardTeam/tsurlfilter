/**
 * Calculates the checksum of the given content using the MD5 hashing algorithm
 * and encodes it in Base64. It normalizes the content by removing carriage
 * returns and replacing multiple newlines with a single newline.
 * The checksum is then formatted with a trailing special comment identifier.
 * Trailing '=' characters in the Base64 encoded string are removed to match
 * the expected format.
 *
 * @see
 * {@link https://adblockplus.org/en/filters#special-comments Adblock Plus special comments}
 * {@link https://hg.adblockplus.org/adblockplus/file/tip/addChecksum.py Adblock Plus checksum script}
 *
 * @param content The content to hash.
 *
 * @returns The formatted checksum string.
 */
export declare const calculateChecksumMD5: (content: string) => string;
/**
 * Checks if the given filter has a valid checksum. If the filter does not have
 * a checksum, it returns false unless the strict parameter is true.
 *
 * @param filter The filter to check.
 * @param strict If true, the function returns true if the filter does not have a
 * checksum.
 * @returns True if the filter has a valid checksum, false otherwise.
 */
export declare const isValidChecksum: (filter: string, strict?: boolean) => boolean;
