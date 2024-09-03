import { WebRequest } from 'webextension-polyfill';
import HttpHeadersItemType = WebRequest.HttpHeadersItemType;
import HttpHeaders = WebRequest.HttpHeaders;

/**
 * Finds header object by header name (case insensitive)
 *
 * @param headers Headers collection
 * @param headerName Header name
 * @returns header value
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
 * Removes header from headers by name
 *
 * @param {Array} headers
 * @param {String} headerName
 * @return {boolean} True if header were removed
 */
export function removeHeader(headers: HttpHeaders, headerName: string): boolean {
    let removed = false;
    if (headers) {
        for (let i = headers.length - 1; i >= 0; i -= 1) {
            const header = headers[i];
            if (header.name.toLowerCase() === headerName.toLowerCase()) {
                headers.splice(i, 1);
                removed = true;
            }
        }
    }

    return removed;
}
