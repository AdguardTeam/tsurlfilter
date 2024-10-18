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

/**
 * Identifies is header with name present in headers collection (case-insensitive).
 *
 * @param headers Headers collection.
 * @param headerName Header name.
 * @returns True if header by name is presented.
 */
export function hasHeaderByName(headers: HttpHeaders, headerName: string): boolean {
    const header = findHeaderByName(headers, headerName);
    return header !== null;
}

/**
 * Identifies is matching header present in headers collection (header name is case-insensitive).
 *
 * @param headers Headers collection.
 * @param header Header object.
 * @returns True if header is present.
 */
export function hasHeader(headers: HttpHeaders, header: HttpHeadersItemType): boolean {
    const foundHeader = findHeaderByName(headers, header.name);
    return !!foundHeader && foundHeader.value === header.value;
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
    const lowerCaseHeaderName = headerName.toLowerCase();
    let removed = false;

    for (let i = headers.length - 1; i >= 0; i -= 1) {
        const header = headers[i];
        if (header.name.toLowerCase() === lowerCaseHeaderName) {
            headers.splice(i, 1);
            removed = true;
        }
    }

    return removed;
}
