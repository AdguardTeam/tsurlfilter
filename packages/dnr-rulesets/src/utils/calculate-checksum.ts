// FIXME: Check, maybe use system 'crypto' module instead of crypto-js
import Base64 from 'crypto-js/enc-base64';
import MD5 from 'crypto-js/md5';

import { splitByLines } from './split-by-lines';

export const CHECKSUM_TAG = 'Checksum';

/**
 * Normalizes a message string by removing carriage return characters ('\r') and
 * replacing multiple newline characters ('\n') with a single newline character.
 * This function standardizes the format of newline characters in the message.
 *
 * @param content The string to normalize.
 *
 * @returns The normalized message with '\r' removed and consecutive '\n'
 * characters replaced with a single '\n'.
 */
const normalizeContent = (content: string): string => {
    return content
        .replace(/\r/g, '')
        .replace(/\n+/g, '\n');
};

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
export const calculateChecksumMD5 = (content: string): string => {
    content = normalizeContent(content);
    const checksum = Base64.stringify(MD5(content));

    return checksum.trim().replace(/=+$/g, '');
};

/**
 * Checks if the provided file content contains a checksum tag within its first 200 characters.
 * This approach is selected to exclude parsing checksums from included filters.
 *
 * @param file The file content as a string.
 *
 * @returns `true` if the checksum tag is found, otherwise `false`.
 */
export const hasChecksum = (file: string): boolean => {
    const partOfFile = file.substring(0, 200);
    const lines = splitByLines(partOfFile);

    return lines.some((line) => line.startsWith(`! ${CHECKSUM_TAG}`));
};
