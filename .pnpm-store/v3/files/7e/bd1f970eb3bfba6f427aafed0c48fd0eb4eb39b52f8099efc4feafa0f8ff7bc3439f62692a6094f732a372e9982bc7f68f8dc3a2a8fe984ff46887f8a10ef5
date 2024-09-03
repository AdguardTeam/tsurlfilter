export const DEFAULT_CHARSET = 'utf-8';
export const LATIN_1 = 'iso-8859-1';
export const WIN_1251 = 'windows-1251';
export const WIN_1252 = 'windows-1252';

/**
 * Supported charsets array
 */
export const SUPPORTED_CHARSETS = [DEFAULT_CHARSET, WIN_1251, WIN_1252, LATIN_1];

/**
 * Parses charset from content-type header
 *
 * @param contentType
 * @returns {*}
 */
export function parseCharsetFromHeader(contentType: string | null): string | null {
    if (!contentType) {
        return null;
    }

    const match = /charset="?(.*?)"?$/.exec(contentType.toLowerCase());
    if (match && match.length > 1) {
        return match[1].toLowerCase();
    }

    return null;
}

/**
 * Parses charset from html, looking for:
 * <meta charset="utf-8" />
 * <meta charset=utf-8 />
 * <meta charset=utf-8>
 * <meta http-equiv="content-type" content="text/html; charset=utf-8" />
 * <meta content="text/html; charset=utf-8" http-equiv="content-type" />
 *
 * @param text
 */
export function parseCharsetFromHtml(text: string): string | null {
    let match = /<meta\s*charset\s*=\s*['"]?(.*?)['"]?\s*\/?>/.exec(text.toLowerCase());
    if (match && match.length > 1) {
        return match[1].trim().toLowerCase();
    }

    // eslint-disable-next-line max-len
    match = /<meta\s*http-equiv\s*=\s*['"]?content-type['"]?\s*content\s*=\s*[\\]?['"]text\/html;\s*charset=(.*?)[\\]?['"]/.exec(text.toLowerCase());
    if (match && match.length > 1) {
        return match[1].trim().toLowerCase();
    }

    // eslint-disable-next-line max-len
    match = /<meta\s*content\s*=\s*[\\]?['"]text\/html;\s*charset=(.*?)[\\]?['"]\s*http-equiv\s*=\s*['"]?content-type['"]?/.exec(text.toLowerCase());
    if (match && match.length > 1) {
        return match[1].trim().toLowerCase();
    }

    return null;
}

/**
 * Parses charset from css
 *
 * @param text
 */
export function parseCharsetFromCss(text: string): string | null {
    const match = /^@charset\s*['"](.*?)['"]/.exec(text.toLowerCase());

    if (match && match.length > 1) {
        return match[1].trim().toLowerCase();
    }

    return null;
}
