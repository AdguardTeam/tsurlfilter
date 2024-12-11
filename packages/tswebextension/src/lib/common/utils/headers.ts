import { remove } from 'lodash-es';
import type { WebRequest } from 'webextension-polyfill';

type HttpHeadersItemType = WebRequest.HttpHeadersItemType;
type HttpHeaders = WebRequest.HttpHeaders;

/**
 * Finds a header object by its name (case-insensitive).
 *
 * @param headers Headers collection.
 * @param headerName Name of the header.
 * @returns The header object if found, or null otherwise.
 */
export function findHeaderByName(headers: HttpHeaders, headerName: string): HttpHeadersItemType | null {
    const targetName = headerName.toLowerCase();
    return headers.find((header) => header.name.toLowerCase() === targetName) || null;
}

/**
 * Checks if a header with the given name exists in the headers collection (case-insensitive).
 *
 * @param headers Headers collection.
 * @param headerName Name of the header to search.
 * @returns True if the header exists, false otherwise.
 */
export function hasHeaderByName(headers: HttpHeaders, headerName: string): boolean {
    return findHeaderByName(headers, headerName) !== null;
}

/**
 * Checks if a specific header (name and value) exists in the headers collection.
 *
 * @param headers Headers collection.
 * @param header The header object to match.
 * @returns True if an exact match for the header exists, false otherwise.
 */
export function hasHeader(headers: HttpHeaders, header: HttpHeadersItemType): boolean {
    const foundHeader = findHeaderByName(headers, header.name);
    return !!foundHeader && foundHeader.value === header.value;
}

/**
 * Removes a header by name from the headers collection (case-insensitive).
 *
 * @param headers Headers collection.
 * @param headerName Name of the header to remove.
 * @returns True if any headers were removed, false otherwise.
 */
export function removeHeader(headers: HttpHeaders, headerName: string): boolean {
    const targetName = headerName.toLowerCase();
    return remove(headers, (header: HttpHeadersItemType) => header.name.toLowerCase() === targetName).length > 0;
}
