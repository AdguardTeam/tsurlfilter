import { type ByteRange } from '../rules/declarative-converter/byte-range-map';

/**
 * Fetches a resource from the given URL, optionally with a specified byte range.
 *
 * @param url The URL of the resource to fetch.
 * @param [range] Optional byte range to specify in the HTTP request.
 *
 * @returns A promise that resolves to the fetch response.
 */
export const fetchExtensionResource = async (url: string, range?: ByteRange): Promise<Response> => {
    if (range) {
        return fetch(url, {
            headers: {
                Range: `bytes=${range.start}-${range.end}`,
            },
        });
    }
    return fetch(url);
};

/**
 * Fetches a resource from the given URL and returns its content as text, optionally with a specified byte range.
 *
 * @param url The URL of the resource to fetch.
 * @param [range] Optional byte range to specify in the HTTP request.
 *
 * @returns A promise that resolves to the fetched content as a string.
 */
export const fetchExtensionResourceText = async (url: string, range?: ByteRange): Promise<string> => {
    return (await fetchExtensionResource(url, range)).text();
};
