import SHA1 from 'crypto-js/sha1';
import MD5 from 'crypto-js/md5';
import Base64 from 'crypto-js/enc-base64';

/**
 * Calculates SHA1 checksum for patch.
 *
 * @param content Content to hash.
 *
 * @returns SHA1 checksum for patch.
 */
export const calculateChecksumSHA1 = (content: string): string => {
    const res = SHA1(content);

    return res.toString();
};

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
