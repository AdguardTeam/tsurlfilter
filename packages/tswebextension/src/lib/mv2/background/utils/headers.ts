import { WebRequest } from 'webextension-polyfill';
import HttpHeaders = WebRequest.HttpHeaders;

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
