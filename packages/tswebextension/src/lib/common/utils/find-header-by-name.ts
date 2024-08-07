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
    const lowerCaseHeaderName = headerName.toLowerCase();

    for (const header of headers) {
        if (header.name.toLowerCase() === lowerCaseHeaderName) {
            return header;
        }
    }

    return null;
}
