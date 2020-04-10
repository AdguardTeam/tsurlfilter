export const DEFAULT_CHARSET = 'utf-8';
export const LATIN_1 = 'iso-8859-1';
export const WIN_1252 = 'windows-1252';

/**
 * Supported charsets array
 */
export const SUPPORTED_CHARSETS = [DEFAULT_CHARSET, 'windows-1251', 'windows-1252', LATIN_1];

/**
 * Parses charset from content-type header
 *
 * @param contentType
 * @returns {*}
 */
export function parseCharsetFromHeader(contentType) {
    if (!contentType) {
        return null;
    }

    const match = /charset=(.*?)$/.exec(contentType.toLowerCase());
    if (match && match.length > 1) {
        return match[1].toLowerCase();
    }

    return null;
}
