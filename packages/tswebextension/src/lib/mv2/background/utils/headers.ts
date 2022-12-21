import { WebRequest } from 'webextension-polyfill';
import HttpHeadersItemType = WebRequest.HttpHeadersItemType;
import HttpHeaders = WebRequest.HttpHeaders;

/**
 * Finds header object by header name (case-insensitive).
 *
 * @param headers Headers collection.
 * @param headerName Header name.
 * @returns Found header, or null if not found.
 */
export function findHeaderByName(headers: HttpHeaders, headerName: string): HttpHeadersItemType | null {
    for (let i = 0; i < headers.length; i += 1) {
        const header = headers[i];
        if (header.name.toLowerCase() === headerName.toLowerCase()) {
            return header;
        }
    }

    return null;
}

/**
 * TODO: Make function pure (don't modify headers, return new object instead)
 * Removes header from headers by name.
 *
 * @param headers Headers collection.
 * @param headerName Header name.
 * @returns True if headers were removed.
 */
export function removeHeader(headers: HttpHeaders, headerName: string): boolean {
    let removed = false;

    for (let i = headers.length - 1; i >= 0; i -= 1) {
        const header = headers[i];
        if (header.name.toLowerCase() === headerName.toLowerCase()) {
            headers.splice(i, 1);
            removed = true;
        }
    }

    return removed;
}
