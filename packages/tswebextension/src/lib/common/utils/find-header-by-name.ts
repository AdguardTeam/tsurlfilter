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
